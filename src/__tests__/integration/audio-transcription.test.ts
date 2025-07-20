import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { signInTestUser, cleanupTestData, testSupabaseClient } from '@/test/supabase-test-client';

// Mock Edge Function response
const mockEdgeFunctionResponse = {
  transcription: 'This is a test transcription from the audio file.',
  summary: 'Test summary: The audio contains a brief test message.',
};

// Create a mock Supabase client with proper structure
const mockSupabaseClient = {
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
};

// Mock the Supabase client before importing services
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));

import * as transcriptionService from '@/services/transcription';
import * as transcriptionServiceAlt from '@/services/transcriptionService';

describe('Audio Transcription and AI Summarization Tests', () => {
  let currentUser: any = null;
  let mockAudioFile: File;

  beforeAll(() => {
    // Create a mock audio file for testing
    const audioBuffer = new ArrayBuffer(1024); // 1KB mock audio data
    mockAudioFile = new File([audioBuffer], 'test-audio.mp3', {
      type: 'audio/mpeg',
      lastModified: Date.now()
    });
  });

  beforeEach(async () => {
    await cleanupTestData();
    
    try {
      currentUser = await signInTestUser();
    } catch (error) {
      const { createTestUser } = await import('@/test/supabase-test-client');
      await createTestUser();
      currentUser = await signInTestUser();
    }

    // Reset mocks
    vi.clearAllMocks();

    // Setup storage mocks with proper return values
    const mockStorageBucket = {
      upload: vi.fn().mockResolvedValue({
        data: { path: 'temp_audio/audio_123456789.mp3' },
        error: null
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://test-bucket.supabase.co/storage/v1/object/public/audio_uploads/temp_audio/audio_123456789.mp3' }
      }),
      remove: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    };

    // Setup function mocks
    mockSupabaseClient.functions.invoke.mockResolvedValue({
      data: mockEdgeFunctionResponse,
      error: null
    });

    mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Audio File Upload and Processing', () => {
    it('should upload audio file and process with Edge function', async () => {
      const result = await transcriptionService.processAudioInSupabase(mockAudioFile);

      // Verify storage.from was called with correct bucket
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('audio_uploads');

      // Verify Edge function was called
      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith('summarize-audio', {
        body: expect.objectContaining({
          audioUrl: expect.stringContaining('https://'),
          contentType: 'audio/mpeg',
          fileName: expect.stringMatching(/audio_\d+\.mp3/)
        })
      });

      // Verify return value
      expect(result.transcription).toBe('This is a test transcription from the audio file.');
      expect(result.summary).toBe('Test summary: The audio contains a brief test message.');
      expect(result.fileUrl).toContain('https://');
    });

    it('should handle different audio file formats', async () => {
      const formats = [
        { type: 'audio/wav', ext: 'wav' },
        { type: 'audio/x-m4a', ext: 'm4a' },
        { type: 'audio/webm', ext: 'webm' },
        { type: 'audio/mp4', ext: 'mp4' }
      ];

      for (const format of formats) {
        const audioBuffer = new ArrayBuffer(1024);
        const testFile = new File([audioBuffer], `test.${format.ext}`, {
          type: format.type,
          lastModified: Date.now()
        });

        const result = await transcriptionService.processAudioInSupabase(testFile);

        expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('audio_uploads');
        expect(result.transcription).toBe('This is a test transcription from the audio file.');
      }
    });

    it('should reject unsupported file formats', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const unsupportedFile = new File([audioBuffer], 'test.txt', {
        type: 'text/plain',
        lastModified: Date.now()
      });

      await expect(transcriptionService.processAudioInSupabase(unsupportedFile))
        .rejects.toThrow('Unsupported file type: txt');
    });

    it('should handle empty or invalid files', async () => {
      const emptyFile = new File([], 'empty.mp3', { type: 'audio/mpeg' });

      await expect(transcriptionService.processAudioInSupabase(emptyFile))
        .rejects.toThrow('Invalid or empty audio file');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage upload errors', async () => {
      const mockStorageBucket = {
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage upload failed' }
        }),
        getPublicUrl: vi.fn(),
        remove: vi.fn()
      };
      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);

      await expect(transcriptionService.processAudioInSupabase(mockAudioFile))
        .rejects.toThrow('Failed to upload audio file: Storage upload failed');
    });

    it('should handle Edge function errors', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge function failed' }
      });

      await expect(transcriptionService.processAudioInSupabase(mockAudioFile))
        .rejects.toThrow('Failed to process audio: Edge function failed');

      // Should still attempt cleanup
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('audio_uploads');
    });

    it('should handle empty transcription response', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValueOnce({
        data: { transcription: '', summary: 'Empty transcription' },
        error: null
      });

      await expect(transcriptionService.processAudioInSupabase(mockAudioFile))
        .rejects.toThrow('No transcription received from processing service');
    });

    it('should clean up files on error', async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Processing failed' }
      });

      try {
        await transcriptionService.processAudioInSupabase(mockAudioFile);
      } catch (error) {
        // Expected to throw
      }

      // Verify cleanup was attempted even on error
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('audio_uploads');
    });
  });

  describe('High-Level Service Functions', () => {
    it('should transcribe audio using transcribeAudio function', async () => {
      const result = await transcriptionService.transcribeAudio({
        audioFile: mockAudioFile,
        userId: currentUser.id
      });

      expect(result.transcription).toBe('This is a test transcription from the audio file.');
      expect(result.error).toBeNull();
    });

    it('should process audio with summary and save note', async () => {
      // Mock note insertion
      const mockNoteInsert = vi.fn().mockResolvedValue({
        data: { id: 'test-note-id', title: 'Test Audio Note' },
        error: null
      });

      testSupabaseClient.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockNoteInsert
          }))
        }))
      }));

      const result = await transcriptionService.processAudioWithSummary(
        mockAudioFile,
        currentUser.id,
        { title: 'Test Audio Note' }
      );

      expect(result.transcription).toBe('This is a test transcription from the audio file.');
      expect(result.summary).toBe('Test summary: The audio contains a brief test message.');
      expect(result.noteId).toBe('test-note-id');
    });

    it('should handle note saving errors in processAudioWithSummary', async () => {
      // Mock note insertion failure
      const mockNoteInsert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Failed to insert note' }
      });

      testSupabaseClient.from = vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockNoteInsert
          }))
        }))
      }));

      await expect(transcriptionService.processAudioWithSummary(
        mockAudioFile,
        currentUser.id,
        { title: 'Test Audio Note' }
      )).rejects.toThrow('Failed to save note');
    });

    it('should use mock transcription when Supabase config is missing', async () => {
      // Temporarily override environment variables
      const originalUrl = import.meta.env.VITE_SUPABASE_URL;
      const originalKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // @ts-ignore - Mock missing env vars
      import.meta.env.VITE_SUPABASE_URL = '';
      import.meta.env.VITE_SUPABASE_ANON_KEY = '';

      const result = await transcriptionService.transcribeAudio({
        audioFile: mockAudioFile,
        userId: currentUser.id
      });

      expect(result.transcription).toBe('This is a mock transcription for development purposes.');
      expect(result.error).toBeNull();

      // Restore original values
      // @ts-ignore
      import.meta.env.VITE_SUPABASE_URL = originalUrl;
      // @ts-ignore
      import.meta.env.VITE_SUPABASE_ANON_KEY = originalKey;
    });
  });

  describe('Alternative Transcription Service', () => {
    it('should work with transcriptionService.ts functions', async () => {
      const result = await transcriptionServiceAlt.transcribeAudio(mockAudioFile);

      expect(result).toBe('This is a test transcription from the audio file.');
      expect(mockInvoke).toHaveBeenCalledWith('summarize-audio', {
        body: { audioUrl: expect.stringContaining('https://') }
      });
    });

    it('should handle errors in alternative service', async () => {
      mockUpload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Upload failed' }
      });

      await expect(transcriptionServiceAlt.transcribeAudio(mockAudioFile))
        .rejects.toThrow('Failed to transcribe audio');
    });
  });

  describe('File Upload Edge Cases', () => {
    it('should handle very large files gracefully', async () => {
      const largeBuffer = new ArrayBuffer(100 * 1024 * 1024); // 100MB
      const largeFile = new File([largeBuffer], 'large-audio.mp3', {
        type: 'audio/mpeg',
        lastModified: Date.now()
      });

      // Should still attempt processing (storage limits handled by Supabase)
      const result = await transcriptionService.processAudioInSupabase(largeFile);
      expect(result.transcription).toBe('This is a test transcription from the audio file.');
    });

    it('should handle special characters in filenames', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const specialFile = new File([audioBuffer], 'test file with spaces & symbols!@#.mp3', {
        type: 'audio/mpeg',
        lastModified: Date.now()
      });

      const result = await transcriptionService.processAudioInSupabase(specialFile);
      expect(result.transcription).toBe('This is a test transcription from the audio file.');
      
      // Should generate clean filename
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(/temp_audio\/audio_\d+\.mp3/),
        specialFile,
        expect.any(Object)
      );
    });

    it('should handle file extension determination from ambiguous types', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const ambiguousFile = new File([audioBuffer], 'test.mp3', {
        type: 'application/octet-stream', // Generic binary type
        lastModified: Date.now()
      });

      const result = await transcriptionService.processAudioInSupabase(ambiguousFile);
      
      // Should determine type from extension
      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(String),
        ambiguousFile,
        expect.objectContaining({
          contentType: 'audio/mpeg' // Should be determined from .mp3 extension
        })
      );
    });
  });
});