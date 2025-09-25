import { vi } from 'vitest';

export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/test-file.wav' },
      }),
      remove: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }),
  },
  functions: {
    invoke: vi.fn().mockResolvedValue({
      data: {
        transcription: 'Test transcription text',
        summary: 'Test summary text',
      },
      error: null,
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: { id: 'test-note-id' },
        error: null,
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'test-note-id',
            title: 'Test Note',
            transcription: 'Test transcription',
            raw_summary: 'Test summary',
          },
          error: null,
        }),
      }),
    }),
  }),
};

// Mock the createClient function
export const createClient = vi.fn().mockReturnValue(mockSupabaseClient);