import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { vi } from 'vitest';

// Create a custom render function that includes all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  queryClient?: QueryClient;
}

// Create a test query client with shorter retry delays
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const AllTheProviders = ({ 
  children, 
  queryClient = createTestQueryClient() 
}: { 
  children: React.ReactNode;
  queryClient?: QueryClient;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>{children}</AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { initialRoute = '/', queryClient, ...renderOptions } = options || {};

  // Set initial route if provided
  window.history.pushState({}, 'Test page', initialRoute);

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Mock Supabase client for tests
export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ 
      data: { 
        session: {
          user: { id: 'mock-user-id', email: 'test@example.com' },
          access_token: 'mock-token',
        } 
      } 
    }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(['mock data']), error: null }),
      remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://mock-url.com/file' } }),
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }),
  }),
  functions: {
    invoke: vi.fn().mockResolvedValue({ 
      data: { 
        transcription: 'Mock transcription',
        summary: 'Mock summary',
      }, 
      error: null 
    }),
  },
};

// Test data factories
export const createMockNote = (overrides = {}) => ({
  id: 'mock-note-id',
  title: 'Mock Note Title',
  transcription: 'This is a mock transcription',
  summary: 'This is a mock summary',
  structuredSummary: null,
  audioUrl: null,
  created_at: new Date().toISOString(),
  folder_id: null,
  user_id: 'mock-user-id',
  preview: 'This is a mock transcription...',
  ...overrides,
});

export const createMockFolder = (overrides = {}) => ({
  id: 'mock-folder-id',
  name: 'Mock Folder',
  parent_id: null,
  user_id: 'mock-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: 'mock-user-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  ...overrides,
});

// Utility to wait for async updates
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render, createTestQueryClient };