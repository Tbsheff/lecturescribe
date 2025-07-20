import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { 
  FileValidationResult, 
  AudioProcessingResult,
  TranscriptionResult,
  AudioWithNoteResult
} from '@/types/transcription';

// Mock global fetch for file verification
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the entire Supabase client module with proper structure
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn()
      }))
    },
    functions: {
      invoke: vi.fn()
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

// Import after mocking
import { 
  validateAudioFile, 
  processAudioInSupabase, 
  transcribeAudio, 
  processAudioWithSummary,
  AudioProcessingError
} from '@/services/transcription';
import { supabase } from '@/integrations/supabase/client';

// Cast to mocked version
const mockSupabaseClient = vi.mocked(supabase);

describe('Audio Transcription Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([
        ['content-type', 'audio/mpeg'],
        ['content-length', '1024']
      ])
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateAudioFile', () => {
    it('should reject empty files', () => {
      const emptyFile = new File([], 'empty.mp3', { type: 'audio/mpeg' });
      
      const result: FileValidationResult = validateAudioFile(emptyFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid or empty audio file');
    });

    it('should reject null/undefined files', () => {
      const result: FileValidationResult = validateAudioFile(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid or empty audio file');
    });

    it('should reject files that are too small', () => {
      const tinyFile = new File(['x'], 'tiny.mp3', { type: 'audio/mpeg' });
      
      const result: FileValidationResult = validateAudioFile(tinyFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File too small');
    });

    it('should reject unsupported file formats', () => {
      // Create a file that's large enough to pass size check but has wrong type
      const textData = new ArrayBuffer(2048);
      const textFile = new File([textData], 'document.txt', { type: 'text/plain' });
      
      const result: FileValidationResult = validateAudioFile(textFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported file type: txt');
    });

    it('should accept valid audio files', () => {
      const audioData = new ArrayBuffer(2048); // 2KB
      const validFile = new File([audioData], 'test.mp3', { type: 'audio/mpeg' });
      
      const result: FileValidationResult = validateAudioFile(validFile);
      expect(result.isValid).toBe(true);
      expect(result.contentType).toBe('audio/mpeg');
      expect(result.error).toBeUndefined();
    });

    it('should determine content type from extension for generic mime types', () => {
      const audioData = new ArrayBuffer(2048);
      const genericFile = new File([audioData], 'test.mp3', { type: 'application/octet-stream' });
      
      const result: FileValidationResult = validateAudioFile(genericFile);
      expect(result.isValid).toBe(true);
      expect(result.contentType).toBe('audio/mpeg');
    });

    it('should support all audio formats', () => {
      const testCases = [
        { extension: 'wav', expectedType: 'audio/wav' },
        { extension: 'mp3', expectedType: 'audio/mpeg' },
        { extension: 'm4a', expectedType: 'audio/x-m4a' },
        { extension: 'webm', expectedType: 'audio/webm' },
        { extension: 'mp4', expectedType: 'audio/mp4' }
      ];

      testCases.forEach(({ extension, expectedType }) => {
        const audioData = new ArrayBuffer(2048);
        const file = new File([audioData], `test.${extension}`, { type: expectedType });
        
        const result: FileValidationResult = validateAudioFile(file);
        expect(result.isValid).toBe(true);
        expect(result.contentType).toBe(expectedType);
      });
    });
  });

  describe('processAudioInSupabase', () => {
    let mockAudioFile: File;
    let mockStorageBucket: any;

    beforeEach(() => {
      const audioData = new ArrayBuffer(2048);
      mockAudioFile = new File([audioData], 'test.mp3', { type: 'audio/mpeg' });

      mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: { path: 'temp_audio/audio_123456789.mp3' },
          error: null
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/temp_audio/audio_123456789.mp3' }
        }),
        remove: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      };

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: {
          transcription: 'This is a test transcription',
          summary: 'This is a test summary',
          confidence: 0.95,
          model_used: 'test-model'
        },
        error: null
      });
    });

    it('should successfully process audio file', async () => {
      const result: AudioProcessingResult = await processAudioInSupabase(mockAudioFile);

      expect(result.transcription).toBe('This is a test transcription');
      expect(result.summary).toBe('This is a test summary');
      expect(result.confidence).toBe(0.95);
      expect(result.fileUrl).toBe('https://example.com/temp_audio/audio_123456789.mp3');
      
      // Verify storage operations
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('audio_uploads');
      expect(mockStorageBucket.upload).toHaveBeenCalled();
      expect(mockStorageBucket.getPublicUrl).toHaveBeenCalled();
      expect(mockStorageBucket.remove).toHaveBeenCalled(); // Cleanup
    });

    it('should call Edge function with correct parameters', async () => {
      await processAudioInSupabase(mockAudioFile);

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('summarize-audio', {
        body: expect.objectContaining({
          audioUrl: 'https://example.com/temp_audio/audio_123456789.mp3',
          contentType: 'audio/mpeg',
          fileName: expect.stringMatching(/audio_\d+\.mp3/)
        })
      });
    });

    it('should handle storage upload errors', async () => {
      mockStorageBucket.upload.mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' }
      });

      await expect(processAudioInSupabase(mockAudioFile))
        .rejects.toThrow(AudioProcessingError);
      
      try {
        await processAudioInSupabase(mockAudioFile);
      } catch (error) {
        expect(error).toBeInstanceOf(AudioProcessingError);
        expect((error as AudioProcessingError).details.type).toBe('UPLOAD_FAILED');
        expect((error as AudioProcessingError).message).toContain('Failed to upload audio file');
      }
    });

    it('should handle Edge function errors', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Processing failed' }
      });

      await expect(processAudioInSupabase(mockAudioFile))
        .rejects.toThrow(AudioProcessingError);
      
      try {
        await processAudioInSupabase(mockAudioFile);
      } catch (error) {
        expect(error).toBeInstanceOf(AudioProcessingError);
        expect((error as AudioProcessingError).details.type).toBe('PROCESSING_FAILED');
      }
    });

    it('should handle empty transcription response', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { transcription: '', summary: 'Empty transcription' },
        error: null
      });

      await expect(processAudioInSupabase(mockAudioFile))
        .rejects.toThrow(AudioProcessingError);
      
      try {
        await processAudioInSupabase(mockAudioFile);
      } catch (error) {
        expect(error).toBeInstanceOf(AudioProcessingError);
        expect((error as AudioProcessingError).details.type).toBe('EMPTY_TRANSCRIPTION');
      }
    });

    it('should clean up files on error', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Processing failed' }
      });

      try {
        await processAudioInSupabase(mockAudioFile);
      } catch (error) {
        // Expected to throw
      }

      // Should still attempt cleanup
      expect(mockStorageBucket.remove).toHaveBeenCalled();
    });

    it('should handle invalid files', async () => {
      const emptyFile = new File([], 'empty.mp3', { type: 'audio/mpeg' });

      await expect(processAudioInSupabase(emptyFile))
        .rejects.toThrow(AudioProcessingError);
      
      try {
        await processAudioInSupabase(emptyFile);
      } catch (error) {
        expect(error).toBeInstanceOf(AudioProcessingError);
        expect((error as AudioProcessingError).details.type).toBe('INVALID_FILE');
      }
    });
  });

  describe('transcribeAudio', () => {
    let mockAudioFile: File;

    beforeEach(() => {
      const audioData = new ArrayBuffer(2048);
      mockAudioFile = new File([audioData], 'test.mp3', { type: 'audio/mpeg' });

      // Setup successful mocks
      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: { path: 'temp_audio/audio_123.mp3' },
          error: null
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/temp_audio/audio_123.mp3' }
        }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null })
      };

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: {
          transcription: 'Transcribed text',
          summary: 'Summary text',
          confidence: 0.92
        },
        error: null
      });
    });

    it('should handle new signature with options object', async () => {
      const result = await transcribeAudio({
        audioFile: mockAudioFile,
        userId: 'test-user-id'
      }) as TranscriptionResult;

      expect(result.transcription).toBe('Transcribed text');
      expect(result.error).toBeNull();
      expect(result.confidence).toBe(0.92);
    });

    it('should handle old signature with file directly', async () => {
      const result = await transcribeAudio(mockAudioFile) as string;

      expect(result).toBe('Transcribed text');
    });

    it('should use normal transcription when environment is configured', async () => {
      // Since our test environment has Supabase configured, this should use the mocked service
      const result = await transcribeAudio({
        audioFile: mockAudioFile,
        userId: 'test-user'
      }) as TranscriptionResult;

      expect(result.transcription).toBe('Transcribed text');
      expect(result.error).toBeNull();
      expect(result.confidence).toBe(0.92);
    });

    it('should handle errors gracefully with new signature', async () => {
      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload error' }
        }),
        getPublicUrl: vi.fn(),
        remove: vi.fn()
      };

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);

      const result = await transcribeAudio({
        audioFile: mockAudioFile,
        userId: 'test-user'
      }) as TranscriptionResult;

      expect(result.transcription).toBe('');
      expect(result.error).toContain('Failed to upload audio file');
    });

    it('should throw errors with old signature', async () => {
      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload error' }
        }),
        getPublicUrl: vi.fn(),
        remove: vi.fn()
      };

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);

      await expect(transcribeAudio(mockAudioFile))
        .rejects.toThrow('Failed to upload audio file');
    });
  });

  describe('processAudioWithSummary', () => {
    let mockAudioFile: File;

    beforeEach(() => {
      const audioData = new ArrayBuffer(2048);
      mockAudioFile = new File([audioData], 'test.mp3', { type: 'audio/mpeg' });

      // Setup successful mocks
      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: { path: 'temp_audio/audio_123.mp3' },
          error: null
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/temp_audio/audio_123.mp3' }
        }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null })
      };

      const mockNotesTable = {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'note-123', title: 'Test Note' },
              error: null
            })
          }))
        }))
      };

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);
      mockSupabaseClient.from.mockReturnValue(mockNotesTable);
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: {
          transcription: 'Note transcription',
          summary: 'Note summary',
          confidence: 0.88
        },
        error: null
      });
    });

    it('should process audio and save note successfully', async () => {
      const result: AudioWithNoteResult = await processAudioWithSummary(
        mockAudioFile,
        'user-123',
        { title: 'Test Note' }
      );

      expect(result.transcription).toBe('Note transcription');
      expect(result.summary).toBe('Note summary');
      expect(result.noteId).toBe('note-123');
      expect(result.confidence).toBe(0.88);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notes');
    });

    it('should handle note saving errors', async () => {
      const mockNotesTable = {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Failed to save note' }
            })
          }))
        }))
      };

      mockSupabaseClient.from.mockReturnValue(mockNotesTable);

      await expect(processAudioWithSummary(
        mockAudioFile,
        'user-123',
        { title: 'Test Note' }
      )).rejects.toThrow(AudioProcessingError);

      try {
        await processAudioWithSummary(mockAudioFile, 'user-123', { title: 'Test Note' });
      } catch (error) {
        expect(error).toBeInstanceOf(AudioProcessingError);
        expect((error as AudioProcessingError).details.type).toBe('NOTE_SAVE_FAILED');
      }
    });

    it('should pass folder ID when provided', async () => {
      await processAudioWithSummary(
        mockAudioFile,
        'user-123',
        { title: 'Test Note', folderId: 'folder-456' }
      );

      const insertCall = mockSupabaseClient.from().insert;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          folder_id: 'folder-456'
        })
      );
    });
  });

  describe('AudioProcessingError', () => {
    it('should create error with proper details', () => {
      const errorDetails = {
        type: 'UPLOAD_FAILED' as const,
        message: 'Test error message',
        fileInfo: {
          name: 'test.mp3',
          size: 1024,
          type: 'audio/mpeg'
        }
      };

      const error = new AudioProcessingError(errorDetails);

      expect(error.name).toBe('AudioProcessingError');
      expect(error.message).toBe('Test error message');
      expect(error.details).toEqual(errorDetails);
      expect(error).toBeInstanceOf(Error);
    });
  });
});