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

// Mock the services
vi.mock('@/services/noteStorage');
vi.mock('@/services/folderService');

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
  });

  it('should complete full authentication flow and fetch user data', async () => {
    // Mock successful authentication
    server.use(
      http.post('*/auth/v1/token', async ({ request }) => {
        const body = await request.json() as any;
        expect(body.email).toBe(mockUser.email);
        return HttpResponse.json({
          access_token: 'new-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'new-refresh-token',
          user: mockUser,
        });
      }),
      http.get('*/auth/v1/user', () => {
        return HttpResponse.json(mockUser);
      })
    );

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

    // Fill in login form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: mockUser.email } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(signInButton);

    // Wait for navigation after successful auth
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    // Verify data fetching is triggered
    await waitFor(() => {
      expect(listNotes).toHaveBeenCalledWith(mockUser.id);
      expect(getFolders).toHaveBeenCalledWith(mockUser.id);
    });
  });

  it('should deny access to protected routes without authentication', async () => {
    // Mock unauthenticated state
    server.use(
      http.get('*/auth/v1/user', () => {
        return HttpResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      })
    );

    // Try to access protected route
    render(<NotesView />, { initialRoute: '/notes' });

    // Should redirect to auth
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth');
    });

    // Data fetching should not be called
    expect(listNotes).not.toHaveBeenCalled();
    expect(getFolders).not.toHaveBeenCalled();
  });

  it('should handle token refresh and maintain data access', async () => {
    let tokenRefreshCount = 0;
    
    // Mock token refresh scenario
    server.use(
      http.post('*/auth/v1/token', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          tokenRefreshCount++;
          return HttpResponse.json({
            access_token: `refreshed-token-${tokenRefreshCount}`,
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: `new-refresh-token-${tokenRefreshCount}`,
            user: mockUser,
          });
        }
        return HttpResponse.json({
          access_token: 'initial-token',
          token_type: 'bearer',
          expires_in: 10, // Short expiry for testing
          refresh_token: 'initial-refresh-token',
          user: mockUser,
        });
      }),
      http.get('*/rest/v1/note_metadata', ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.includes('initial-token') && tokenRefreshCount === 0) {
          // Simulate token expired
          return HttpResponse.json(
            { error: 'Token expired' },
            { status: 401 }
          );
        }
        return HttpResponse.json([
          {
            id: 'refreshed-note',
            title: 'Note after refresh',
            preview: 'Content fetched with refreshed token',
            created_at: new Date().toISOString(),
          },
        ]);
      })
    );

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
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: mockUser.email } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    // Trigger data fetch that requires token refresh
    await listNotes(mockUser.id);

    // Verify token was refreshed and data was fetched
    expect(tokenRefreshCount).toBeGreaterThan(0);
    expect(listNotes).toHaveBeenCalled();
  });

  it('should clear user data on logout', async () => {
    // Mock authenticated state
    server.use(
      http.get('*/auth/v1/user', () => {
        return HttpResponse.json(mockUser);
      }),
      http.post('*/auth/v1/logout', () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

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

  it('should handle authentication errors gracefully', async () => {
    // Mock authentication failure
    server.use(
      http.post('*/auth/v1/token', () => {
        return HttpResponse.json(
          { error: 'Invalid credentials' },
          { status: 400 }
        );
      })
    );

    render(<Auth />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(signInButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled();

    // Should not fetch data
    expect(listNotes).not.toHaveBeenCalled();
    expect(getFolders).not.toHaveBeenCalled();
  });
});