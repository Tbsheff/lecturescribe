import { vi } from 'vitest';

// Create a more comprehensive mock for Supabase client
export const createMockSupabaseClient = () => {
  const mockFrom = vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }));

  const mockStorage = {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn(),
      download: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(),
      copy: vi.fn(),
      move: vi.fn(),
      getPublicUrl: vi.fn(),
    })),
  };

  const mockAuth = {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };

  const mockFunctions = {
    invoke: vi.fn(),
  };

  return {
    from: mockFrom,
    storage: mockStorage,
    auth: mockAuth,
    functions: mockFunctions,
  };
};

// Default mock instance
export const mockSupabaseClient = createMockSupabaseClient();