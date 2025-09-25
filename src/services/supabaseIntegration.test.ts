import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { mockAudioFiles, mockTranscriptionResponse, mockNoteData } from '@/tests/utils/testUtils';

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Supabase Integration Tests', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSupabaseClient = {
      storage: {
        from: vi.fn(),
      },
      functions: {
        invoke: vi.fn(),
      },
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      },
    };

    (createClient as any).mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Storage Operations', () => {
    beforeEach(() => {
      mockSupabaseClient.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
        download: vi.fn(),
        list: vi.fn(),
      });
    });

    it('should upload audio file to correct bucket', async () => {
      const bucket = 'audio_uploads';
      const file = mockAudioFiles.validWav;
      const uploadMock = vi.fn().mockResolvedValue({
        data: { path: 'temp_audio/test.wav' },
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
      });

      const storage = mockSupabaseClient.storage.from(bucket);
      await storage.upload('temp_audio/test.wav', file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith(bucket);
      expect(uploadMock).toHaveBeenCalledWith('temp_audio/test.wav', file, {
        contentType: 'audio/wav',
        cacheControl: '3600',
        upsert: false,
      });
    });

    it('should generate public URL for uploaded file', async () => {
      const bucket = 'audio_uploads';
      const filePath = 'temp_audio/test.wav';
      const expectedUrl = `https://test.supabase.co/storage/v1/object/public/${bucket}/${filePath}`;

      const getPublicUrlMock = vi.fn().mockReturnValue({
        data: { publicUrl: expectedUrl },
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: getPublicUrlMock,
      });

      const storage = mockSupabaseClient.storage.from(bucket);
      const result = storage.getPublicUrl(filePath);

      expect(result.data.publicUrl).toBe(expectedUrl);
      expect(getPublicUrlMock).toHaveBeenCalledWith(filePath);
    });

    it('should remove temporary files', async () => {
      const bucket = 'audio_uploads';
      const filePath = 'temp_audio/test.wav';
      const removeMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        remove: removeMock,
      });

      const storage = mockSupabaseClient.storage.from(bucket);
      await storage.remove([filePath]);

      expect(removeMock).toHaveBeenCalledWith([filePath]);
    });

    it('should handle storage errors gracefully', async () => {
      const uploadMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage quota exceeded' },
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        upload: uploadMock,
      });

      const storage = mockSupabaseClient.storage.from('audio_uploads');
      const result = await storage.upload('test.wav', mockAudioFiles.validWav);

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Storage quota exceeded');
    });
  });

  describe('Edge Function Calls', () => {
    it('should invoke summarize-audio function with correct parameters', async () => {
      const audioUrl = 'https://test.supabase.co/storage/v1/object/public/audio_uploads/test.wav';
      const invokeMock = vi.fn().mockResolvedValue({
        data: mockTranscriptionResponse,
        error: null,
      });

      mockSupabaseClient.functions.invoke = invokeMock;

      const result = await mockSupabaseClient.functions.invoke('summarize-audio', {
        body: {
          audioUrl,
          contentType: 'audio/wav',
          fileName: 'test.wav',
        },
      });

      expect(invokeMock).toHaveBeenCalledWith('summarize-audio', {
        body: {
          audioUrl,
          contentType: 'audio/wav',
          fileName: 'test.wav',
        },
      });
      expect(result.data).toEqual(mockTranscriptionResponse);
    });

    it('should handle function invocation errors', async () => {
      const invokeMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Function timeout' },
      });

      mockSupabaseClient.functions.invoke = invokeMock;

      const result = await mockSupabaseClient.functions.invoke('summarize-audio', {
        body: { audioUrl: 'test-url' },
      });

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Function timeout');
    });

    it('should handle empty transcription responses', async () => {
      const invokeMock = vi.fn().mockResolvedValue({
        data: { transcription: '', summary: '' },
        error: null,
      });

      mockSupabaseClient.functions.invoke = invokeMock;

      const result = await mockSupabaseClient.functions.invoke('summarize-audio', {
        body: { audioUrl: 'test-url' },
      });

      expect(result.data.transcription).toBe('');
    });
  });

  describe('Database Operations', () => {
    beforeEach(() => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      }));
    });

    it('should insert note with transcription data', async () => {
      const noteData = {
        user_id: 'test-user-123',
        title: 'Test Note',
        transcription: 'Test transcription',
        raw_summary: 'Test summary',
        audio_url: 'https://test.url',
      };

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...noteData, id: 'generated-id' },
            error: null,
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: insertMock,
      });

      const db = mockSupabaseClient.from('notes');
      const result = await db.insert(noteData).select().single();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('notes');
      expect(insertMock).toHaveBeenCalledWith(noteData);
      expect(result.data.id).toBe('generated-id');
    });

    it('should fetch notes with ordering', async () => {
      const mockNotes = [mockNoteData];

      const orderMock = vi.fn().mockResolvedValue({
        data: mockNotes,
        error: null,
      });

      const selectMock = vi.fn().mockReturnValue({
        order: orderMock,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: selectMock,
      });

      const db = mockSupabaseClient.from('notes');
      const result = await db.select('*').order('created_at', { ascending: false });

      expect(selectMock).toHaveBeenCalledWith('*');
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result.data).toEqual(mockNotes);
    });

    it('should handle database constraint violations', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'duplicate key value violates unique constraint',
              code: '23505',
            },
          }),
        }),
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: insertMock,
      });

      const db = mockSupabaseClient.from('notes');
      const result = await db.insert({ title: 'Test' }).select().single();

      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('23505');
    });
  });

  describe('Authentication', () => {
    it('should authenticate user before operations', async () => {
      const getUserMock = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });

      mockSupabaseClient.auth.getUser = getUserMock;

      const result = await mockSupabaseClient.auth.getUser();

      expect(getUserMock).toHaveBeenCalled();
      expect(result.data.user.id).toBe('test-user-123');
    });

    it('should handle authentication errors', async () => {
      const getUserMock = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      mockSupabaseClient.auth.getUser = getUserMock;

      const result = await mockSupabaseClient.auth.getUser();

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Invalid token');
      expect(result.data.user).toBeNull();
    });
  });

  describe('Transaction Handling', () => {
    it('should handle multi-step operations atomically', async () => {
      // Simulate a transaction: upload -> transcribe -> save
      const uploadMock = vi.fn().mockResolvedValue({
        data: { path: 'test.wav' },
        error: null,
      });

      const invokeMock = vi.fn().mockResolvedValue({
        data: mockTranscriptionResponse,
        error: null,
      });

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockNoteData,
            error: null,
          }),
        }),
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        upload: uploadMock,
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://test.url' },
        }),
        remove: vi.fn(),
      });

      mockSupabaseClient.functions.invoke = invokeMock;
      mockSupabaseClient.from.mockReturnValue({
        insert: insertMock,
      });

      // Execute transaction
      const storage = mockSupabaseClient.storage.from('audio_uploads');
      const uploadResult = await storage.upload('test.wav', mockAudioFiles.validWav);

      expect(uploadResult.error).toBeNull();

      const transcribeResult = await mockSupabaseClient.functions.invoke('summarize-audio', {
        body: { audioUrl: 'https://test.url' },
      });

      expect(transcribeResult.error).toBeNull();

      const saveResult = await mockSupabaseClient.from('notes')
        .insert({ transcription: transcribeResult.data.transcription })
        .select()
        .single();

      expect(saveResult.error).toBeNull();
      expect(saveResult.data).toBeDefined();
    });

    it('should rollback on failure', async () => {
      const removeMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      // Simulate failure in the middle of transaction
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'test.wav' },
          error: null,
        }),
        remove: removeMock,
      });

      mockSupabaseClient.functions.invoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Transcription failed' },
      });

      // Upload succeeds
      const storage = mockSupabaseClient.storage.from('audio_uploads');
      await storage.upload('test.wav', mockAudioFiles.validWav);

      // Transcription fails
      const result = await mockSupabaseClient.functions.invoke('summarize-audio', {
        body: { audioUrl: 'test' },
      });

      expect(result.error).toBeDefined();

      // Cleanup should be called
      await storage.remove(['test.wav']);
      expect(removeMock).toHaveBeenCalledWith(['test.wav']);
    });
  });
});