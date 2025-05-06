import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// In development or preview environments, provide fallback values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-key';

// Provide a mock client for development and preview environments
const isMockEnvironment = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// If we're in a mock environment, we'll intercept the auth methods
if (isMockEnvironment) {
  console.warn('Running with mock Supabase client. Authentication will use local storage only.');
  
  // Mock user data for development
  const mockUser = {
    id: 'mock-user-id',
    email: 'user@example.com',
    role: 'authenticated',
    aud: 'authenticated',
  };

  // Override auth methods for development
  const mockSession = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    user: mockUser,
  };

  // Store the mock auth state
  let mockAuthState = {
    isSignedIn: false,
    session: null as any,
  };

  // Override auth methods with mock implementations
  const originalAuth = supabase.auth;
  supabase.auth = {
    ...originalAuth,
    getSession: async () => {
      return mockAuthState.isSignedIn 
        ? { data: { session: mockSession }, error: null }
        : { data: { session: null }, error: null };
    },
    signInWithPassword: async ({ email, password }: { email: string, password: string }) => {
      // Simple validation - any non-empty values work
      if (email && password) {
        mockAuthState.isSignedIn = true;
        mockAuthState.session = mockSession;
        return { data: { session: mockSession, user: mockUser }, error: null };
      }
      return { data: { session: null, user: null }, error: new Error('Invalid credentials') };
    },
    signUp: async ({ email, password }: { email: string, password: string }) => {
      if (email && password) {
        mockAuthState.isSignedIn = true;
        mockAuthState.session = mockSession;
        return { data: { session: mockSession, user: mockUser }, error: null };
      }
      return { data: { session: null, user: null }, error: new Error('Invalid credentials') };
    },
    signOut: async () => {
      mockAuthState.isSignedIn = false;
      mockAuthState.session = null;
      return { error: null };
    },
    onAuthStateChange: (callback: any) => {
      // Return a mock subscription
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  } as typeof originalAuth;
}
