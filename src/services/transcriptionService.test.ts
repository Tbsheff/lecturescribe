import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockAudioFiles, mockTranscriptionResponse, mockNoteData } from '@/tests/utils/testUtils';
import {
  TranscriptionService,
  createTranscriptionService,
  ValidationError,
  UploadError,
  TranscriptionError
} from './transcriptionService';

// Mock noteStorage
vi.mock('./noteStorage', () => ({
  getNote: vi.fn(),
}));

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create mock Supabase client with all necessary methods
    mockSupabaseClient = {
      storage: {
        from: vi.fn(),
      },
      functions: {
        invoke: vi.fn(),
      },
      from: vi.fn(),
    };

    // Setup default mock implementations
    const storageMock = {
      upload: vi.fn().mockResolvedValue({
        data: { path: 'temp_audio/test-file.wav' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/audio_uploads/test-file.wav' },
      }),
      remove: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    mockSupabaseClient.storage.from.mockReturnValue(storageMock);

    mockSupabaseClient.functions.invoke.mockResolvedValue({
      data: mockTranscriptionResponse,
      error: null,
    });

    mockSupabaseClient.from.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [mockNoteData],
          error: null,
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockNoteData,
            error: null,
          }),
        }),
      }),
    }));

    // Create service instance with mock client
    service = new TranscriptionService(mockSupabaseClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe a valid audio file', async () => {
      const result = await service.transcribeAudio(mockAudioFiles.validWav);

      expect(result).toBe(mockTranscriptionResponse.transcription);
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('audio_uploads');
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('summarize-audio', {
        body: expect.objectContaining({
          audioUrl: expect.stringContaining('https://'),
          contentType: 'audio/wav',
          fileName: expect.stringContaining('.wav'),
        }),
      });
    });

    it('should handle upload errors gracefully', async () => {
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' },
        }),
        getPublicUrl: vi.fn(),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(service.transcribeAudio(mockAudioFiles.validWav))
        .rejects.toThrow('Audio processing failed: Failed to upload audio file: Upload failed');
    });

    it('should handle transcription function errors', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Transcription failed' },
      });

      await expect(service.transcribeAudio(mockAudioFiles.validWav))
        .rejects.toThrow('Audio processing failed: Failed to process audio: Transcription failed');
    });

    it('should clean up temporary files after successful transcription', async () => {
      await service.transcribeAudio(mockAudioFiles.validWav);

      const storageMock = mockSupabaseClient.storage.from('audio_uploads');
      expect(storageMock.remove).toHaveBeenCalled();
    });

    it('should clean up temporary files even on error', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Transcription failed' },
      });

      try {
        await service.transcribeAudio(mockAudioFiles.validWav);
      } catch (error) {
        // Expected to throw
      }

      const storageMock = mockSupabaseClient.storage.from('audio_uploads');
      expect(storageMock.remove).toHaveBeenCalled();
    });

    it('should reject empty files', async () => {
      await expect(service.transcribeAudio(mockAudioFiles.emptyFile))
        .rejects.toThrow('Invalid or empty audio file');
    });

    it('should reject oversized files', async () => {
      await expect(service.transcribeAudio(mockAudioFiles.oversizedFile))
        .rejects.toThrow('File is too large. Maximum size is 100MB');
    });

    it('should reject unsupported file types', async () => {
      await expect(service.transcribeAudio(mockAudioFiles.invalidType))
        .rejects.toThrow('Unsupported file type');
    });
  });

  describe('processAudioWithSummary', () => {
    const userId = 'test-user-123';
    const metadata = { title: 'Test Recording' };

    it('should process audio and save note successfully', async () => {
      const result = await service.processAudioWithSummary(
        mockAudioFiles.validWav,
        userId,
        metadata
      );

      expect(result).toEqual({
        transcription: mockTranscriptionResponse.transcription,
        summary: mockTranscriptionResponse.summary,
        noteId: mockNoteData.id,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notes');
      // Get the actual mock that was returned from the from() call
      const fromMock = mockSupabaseClient.from.mock.results[
        mockSupabaseClient.from.mock.results.length - 1
      ].value;
      expect(fromMock.insert).toHaveBeenCalledWith({
        user_id: userId,
        title: metadata.title,
        transcription: mockTranscriptionResponse.transcription,
        raw_summary: mockTranscriptionResponse.summary,
        audio_url: expect.stringContaining('https://'),
      });
    });

    it('should handle note save errors', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Failed to save note' },
            }),
          }),
        }),
      }));

      await expect(
        service.processAudioWithSummary(mockAudioFiles.validWav, userId, metadata)
      ).rejects.toThrow('Failed to save note');
    });
  });

  describe('fetchNotes', () => {
    it('should fetch and format notes correctly', async () => {
      const mockNotes = [
        {
          ...mockNoteData,
          id: 'note-1',
          title: 'Note 1',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          ...mockNoteData,
          id: 'note-2',
          title: 'Note 2',
          created_at: '2024-01-02T10:00:00Z',
        },
      ];

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockNotes,
            error: null,
          }),
        }),
      }));

      const result = await service.fetchNotes();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'note-1',
        title: 'Note 1',
        date: expect.any(Date),
        preview: expect.any(String),
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notes');
    });

    it('should handle fetch errors', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      }));

      await expect(service.fetchNotes()).rejects.toThrow('Failed to fetch notes');
    });

    it('should handle empty notes list', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }));

      const result = await service.fetchNotes();
      expect(result).toEqual([]);
    });
  });

  describe('fetchNoteById', () => {
    it('should fetch a specific note by ID', async () => {
      const { getNote } = await import('./noteStorage');
      (getNote as any).mockResolvedValue(mockNoteData);

      const result = await service.fetchNoteById('test-note-123');

      expect(result).toEqual(mockNoteData);
      expect(getNote).toHaveBeenCalledWith('test-note-123');
    });

    it('should handle note not found', async () => {
      const { getNote } = await import('./noteStorage');
      (getNote as any).mockResolvedValue(null);

      await expect(service.fetchNoteById('non-existent'))
        .rejects.toThrow('Note with ID non-existent not found');
    });
  });

  describe('Factory function', () => {
    it('should create service with provided client', () => {
      const customClient = {
        storage: { from: vi.fn() },
        functions: { invoke: vi.fn() },
        from: vi.fn(),
      } as any;

      const customService = createTranscriptionService(customClient);
      expect(customService).toBeInstanceOf(TranscriptionService);
    });

    it('should create service with default client when none provided', () => {
      // We can't easily test the default client creation without mocking at module level
      // Just verify that the factory function creates a service instance
      const defaultService = createTranscriptionService();
      expect(defaultService).toBeInstanceOf(TranscriptionService);

      // Verify it has the expected methods
      expect(defaultService.transcribeAudio).toBeDefined();
      expect(defaultService.processAudioWithSummary).toBeDefined();
      expect(defaultService.fetchNotes).toBeDefined();
      expect(defaultService.fetchNoteById).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle empty transcription response', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { transcription: '', summary: '' },
        error: null,
      });

      await expect(service.transcribeAudio(mockAudioFiles.validWav))
        .rejects.toThrow('No transcription received from processing service');
    });

    it('should handle missing transcription in response', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { summary: 'Some summary' },
        error: null,
      });

      await expect(service.transcribeAudio(mockAudioFiles.validWav))
        .rejects.toThrow('No transcription received from processing service');
    });

    it('should handle null response data', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.transcribeAudio(mockAudioFiles.validWav))
        .rejects.toThrow('No transcription received from processing service');
    });
  });
});