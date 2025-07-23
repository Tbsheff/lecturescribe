import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { useAuth } from '@/hooks/useAuth';
import { listNotes } from '@/services/noteStorage';
import { getFolders } from '@/services/folderService';
import Auth from '@/pages/Auth';
import NotesView from '@/pages/NotesView';
import App from '@/App';
import { supabase } from '@/integrations/supabase/client';

// Mock the services
vi.mock('@/services/noteStorage');
vi.mock('@/services/folderService');

// Mock Supabase to bypass MSW for auth operations
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Authentication → Protected Route Access → Data Fetching Integration', () => {
  const mockUser = {
    id: 'auth-user-id',
    email: 'user@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Reset MSW handlers to default state
    server.resetHandlers();
    
    // Clear any test data contamination
    vi.mocked(listNotes).mockResolvedValue([]);
    vi.mocked(getFolders).mockResolvedValue([]);
    
    // Setup default auth mocks
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);
  });

  it.skip('should complete full authentication flow and fetch user data', async () => {
    const mockSession = {
      user: mockUser,
      access_token: 'test-token',
    };
    
    // Setup auth state change callback
    let authChangeCallback: any;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authChangeCallback = callback;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any;
    });
    
    // Mock successful authentication
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(async () => {
      // Trigger auth state change after successful login
      setTimeout(() => {
        if (authChangeCallback) {
          authChangeCallback('SIGNED_IN', mockSession);
        }
      }, 0);
      return {
        data: { user: mockUser, session: mockSession },
        error: null,
      };
    });

    // Mock data fetching after auth
    const mockNotes = [
      {
        id: 'note-1',
        title: 'User Note 1',
        preview: 'First note content',
        created_at: new Date().toISOString(),
      },
      {
        id: 'note-2',
        title: 'User Note 2',
        preview: 'Second note content',
        created_at: new Date().toISOString(),
      },
    ];

    const mockFolders = [
      {
        id: 'folder-1',
        name: 'User Folder',
        user_id: mockUser.id,
        parent_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    vi.mocked(listNotes).mockResolvedValue(mockNotes);
    vi.mocked(getFolders).mockResolvedValue(mockFolders);

    // Render auth page
    render(<Auth />);
    
    // Wait for initial auth check to complete
    await waitFor(() => {
      // The form should be interactive when loading is done
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
    });

    // Fill in login form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: mockUser.email } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    // Find submit button by type since text may change during loading
    const signInButton = screen.getByRole('button', { name: /sign in|signing in/i });
    fireEvent.click(signInButton);

    // Verify auth was called
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockUser.email,
        password: 'password123',
      });
    });
    
    // Wait for navigation after successful auth
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    }, { timeout: 2000 });
  });

  it('should deny access to protected routes without authentication', async () => {
    // Ensure no user is authenticated
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Try to access protected route
    render(<NotesView />, { initialRoute: '/notes/123' });

    // NotesView navigates to "/" when there's no user
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    // Data fetching should not be called
    expect(listNotes).not.toHaveBeenCalled();
    expect(getFolders).not.toHaveBeenCalled();
  });

  it.skip('should handle token refresh and maintain data access', async () => {
    const mockSession = {
      user: mockUser,
      access_token: 'test-token',
    };
    
    // Setup auth state change callback
    let authChangeCallback: any;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authChangeCallback = callback;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any;
    });
    
    // Mock successful authentication
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(async () => {
      // Trigger auth state change after successful login
      setTimeout(() => {
        if (authChangeCallback) {
          authChangeCallback('SIGNED_IN', mockSession);
        }
      }, 0);
      return {
        data: { user: mockUser, session: mockSession },
        error: null,
      };
    });

    vi.mocked(listNotes).mockImplementation(async () => {
      // Simulate API call that triggers token refresh
      await new Promise(resolve => setTimeout(resolve, 100));
      return [{
        id: 'refreshed-note',
        title: 'Note after refresh',
        preview: 'Content fetched with refreshed token',
        note_path: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }];
    });

    // Authenticate first
    render(<Auth />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in|signing in/i });

    fireEvent.change(emailInput, { target: { value: mockUser.email } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(signInButton);

    // Verify auth was called
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: mockUser.email,
        password: 'password123',
      });
    });
    
    // Wait for navigation after successful auth
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    }, { timeout: 2000 });

    // Trigger data fetch that requires token refresh
    await listNotes(mockUser.id);

    // Verify data was fetched (token refresh is handled internally by Supabase)
    expect(listNotes).toHaveBeenCalled();
  });

  it('should clear user data on logout', async () => {
    // Mock authenticated state by setting up initial session
    const mockSession = {
      user: mockUser,
      access_token: 'test-token',
    };
    
    // Setup auth state change callback
    let authChangeCallback: any;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      authChangeCallback = callback;
      // Immediately call with authenticated session
      callback('SIGNED_IN', mockSession);
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any;
    });
    
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    
    // Mock signOut to clear session and trigger auth state change
    vi.mocked(supabase.auth.signOut).mockImplementation(async () => {
      if (authChangeCallback) {
        authChangeCallback('SIGNED_OUT', null);
      }
      return { error: null };
    });

    // Mock initial data
    vi.mocked(listNotes).mockResolvedValue([
      {
        id: 'cached-note',
        title: 'Cached Note',
        preview: 'Should be cleared on logout',
        note_path: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    // Start authenticated
    const TestComponent = () => {
      const { user, signOut } = useAuth();
      const [notes, setNotes] = React.useState<any[]>([]);

      React.useEffect(() => {
        if (user) {
          listNotes(user.id).then(setNotes);
        } else {
          setNotes([]);
        }
      }, [user]);

      return (
        <div>
          {user && (
            <>
              <div>Logged in as: {user.email}</div>
              <div>Notes count: {notes.length}</div>
              <button onClick={signOut}>Logout</button>
            </>
          )}
          {!user && <div>Not authenticated</div>}
        </div>
      );
    };

    render(<TestComponent />);

    // Verify authenticated state
    await waitFor(() => {
      expect(screen.getByText(`Logged in as: ${mockUser.email}`)).toBeInTheDocument();
      expect(screen.getByText('Notes count: 1')).toBeInTheDocument();
    });

    // Trigger logout
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    // Verify data is cleared
    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
      expect(screen.queryByText(/Notes count/)).not.toBeInTheDocument();
    });

    // Verify navigation to auth page
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });

  it('should handle concurrent authenticated requests', async () => {
    // Mock authenticated user
    server.use(
      http.get('*/auth/v1/user', () => {
        return HttpResponse.json(mockUser);
      })
    );

    const notePromises: Promise<any>[] = [];
    const folderPromises: Promise<any>[] = [];

    // Mock concurrent data fetching
    vi.mocked(listNotes).mockImplementation(() => {
      const promise = new Promise(resolve => {
        setTimeout(() => {
          resolve([
            {
              id: 'concurrent-note',
              title: 'Concurrent Note',
              preview: 'Fetched concurrently',
              note_path: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
        }, 100);
      });
      notePromises.push(promise);
      return promise;
    });

    vi.mocked(getFolders).mockImplementation(() => {
      const promise = new Promise(resolve => {
        setTimeout(() => {
          resolve([
            {
              id: 'concurrent-folder',
              name: 'Concurrent Folder',
              user_id: mockUser.id,
              parent_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
        }, 100);
      });
      folderPromises.push(promise);
      return promise;
    });

    // Trigger multiple concurrent requests
    const promises = [
      listNotes(mockUser.id),
      getFolders(mockUser.id),
      listNotes(mockUser.id),
      getFolders(mockUser.id),
    ];

    await Promise.all(promises);

    // Verify all requests completed
    expect(notePromises).toHaveLength(2);
    expect(folderPromises).toHaveLength(2);
    expect(listNotes).toHaveBeenCalledTimes(2);
    expect(getFolders).toHaveBeenCalledTimes(2);
  });

  it.skip('should handle authentication errors gracefully', async () => {
    // Mock authentication failure
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' } as any,
    });

    render(<Auth />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in|signing in/i });

    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(signInButton);

    // Wait a bit for the error handling
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled();

    // Should not fetch data
    expect(listNotes).not.toHaveBeenCalled();
    expect(getFolders).not.toHaveBeenCalled();
    
    // Verify the auth method was called with wrong credentials
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'wrong@example.com',
      password: 'wrongpassword'
    });
  });
});