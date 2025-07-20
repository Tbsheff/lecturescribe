import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@/test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { QueryClient } from '@tanstack/react-query';
import * as ReactQuery from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import App from '@/App';

// Mock modules
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { 
          subscription: { 
            unsubscribe: vi.fn() 
          } 
        },
        unsubscribe: vi.fn(),
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        download: vi.fn(),
        getPublicUrl: vi.fn(),
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('State Management Integration Across Features', () => {
  const mockUser = {
    id: 'state-user-id',
    email: 'state@example.com',
  };

  const mockSession = {
    user: mockUser,
    access_token: 'mock-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup auth mocks
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    
    // onAuthStateChange is already mocked in the vi.mock above
  });

  describe('Global State Synchronization', () => {
    it('should sync auth state across multiple components', async () => {
      // Component that displays auth state
      const AuthDisplay = () => {
        const { user, loading } = useAuth();
        return (
          <div>
            {loading && <div>Loading auth...</div>}
            {user && <div>User: {user.email}</div>}
            {!user && !loading && <div>Not logged in</div>}
          </div>
        );
      };

      // Component that modifies auth state
      const AuthActions = () => {
        const { signIn, signOut } = useAuth();
        return (
          <div>
            <button onClick={() => signIn('test@example.com', 'password')}>
              Sign In
            </button>
            <button onClick={signOut}>Sign Out</button>
          </div>
        );
      };

      // Parent component with shared auth state
      const TestApp = () => {
        return (
          <AuthProvider>
            <AuthDisplay />
            <AuthActions />
          </AuthProvider>
        );
      };

      render(<TestApp />);

      // Initial state
      await waitFor(() => {
        expect(screen.getByText(`User: ${mockUser.email}`)).toBeInTheDocument();
      });

      // Mock sign out
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
      
      // Trigger auth state change
      const authStateCallback = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
      
      // Sign out
      fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
      
      // Simulate auth state change
      act(() => {
        authStateCallback('SIGNED_OUT', null);
      });

      // Both components should reflect the change
      await waitFor(() => {
        expect(screen.getByText('Not logged in')).toBeInTheDocument();
        expect(screen.queryByText(/User:/)).not.toBeInTheDocument();
      });
    });

    it('should maintain state consistency during concurrent updates', async () => {
      const StateConsistencyTest = () => {
        const [notes, setNotes] = React.useState<any[]>([]);
        const [folders, setFolders] = React.useState<any[]>([]);
        const [loading, setLoading] = React.useState({ notes: false, folders: false });

        const loadData = async () => {
          setLoading({ notes: true, folders: true });

          // Simulate concurrent API calls
          const [notesResponse, foldersResponse] = await Promise.all([
            new Promise(resolve => setTimeout(() => resolve([
              { id: '1', title: 'Note 1', folder_id: 'folder-1' },
              { id: '2', title: 'Note 2', folder_id: 'folder-2' },
            ]), 100)),
            new Promise(resolve => setTimeout(() => resolve([
              { id: 'folder-1', name: 'Folder 1' },
              { id: 'folder-2', name: 'Folder 2' },
            ]), 150)),
          ]);

          setNotes(notesResponse as any[]);
          setFolders(foldersResponse as any[]);
          setLoading({ notes: false, folders: false });
        };

        const moveNote = (noteId: string, newFolderId: string) => {
          setNotes(prev => prev.map(note => 
            note.id === noteId ? { ...note, folder_id: newFolderId } : note
          ));
        };

        const getFolderNoteCount = (folderId: string) => {
          return notes.filter(note => note.folder_id === folderId).length;
        };

        return (
          <div>
            <button onClick={loadData}>Load Data</button>
            {loading.notes || loading.folders ? (
              <div>Loading...</div>
            ) : (
              <>
                <div>
                  {folders.map(folder => (
                    <div key={folder.id}>
                      {folder.name} ({getFolderNoteCount(folder.id)} notes)
                    </div>
                  ))}
                </div>
                <div>
                  {notes.map(note => (
                    <div key={note.id}>
                      {note.title}
                      <button onClick={() => moveNote(note.id, 'folder-2')}>
                        Move to Folder 2
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      };

      render(<StateConsistencyTest />);

      // Load data
      fireEvent.click(screen.getByRole('button', { name: /load data/i }));

      await waitFor(() => {
        expect(screen.getByText('Folder 1 (1 notes)')).toBeInTheDocument();
        expect(screen.getByText('Folder 2 (1 notes)')).toBeInTheDocument();
      });

      // Move note 1 to folder 2
      const moveButtons = screen.getAllByRole('button', { name: /move to folder 2/i });
      fireEvent.click(moveButtons[0]);

      // State should update consistently
      await waitFor(() => {
        expect(screen.getByText('Folder 1 (0 notes)')).toBeInTheDocument();
        expect(screen.getByText('Folder 2 (2 notes)')).toBeInTheDocument();
      });
    });
  });

  describe('React Query Cache Management', () => {
    it('should handle cache updates across related queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const CacheManagementTest = () => {
        const { data: notes, refetch: refetchNotes } = ReactQuery.useQuery({
          queryKey: ['notes'],
          queryFn: async () => {
            const response = await fetch('/api/notes');
            return response.json();
          },
        });

        const { data: folders } = ReactQuery.useQuery({
          queryKey: ['folders'],
          queryFn: async () => {
            const response = await fetch('/api/folders');
            return response.json();
          },
        });

        const createNoteMutation = ReactQuery.useMutation({
          mutationFn: async (noteData: any) => {
            const response = await fetch('/api/notes', {
              method: 'POST',
              body: JSON.stringify(noteData),
            });
            return response.json();
          },
          onSuccess: (newNote) => {
            // Update notes cache
            queryClient.setQueryData(['notes'], (old: any[]) => {
              return [...(old || []), newNote];
            });
            
            // Invalidate folders if note has folder_id
            if (newNote.folder_id) {
              queryClient.invalidateQueries({ queryKey: ['folders'] });
            }
          },
        });

        return (
          <div>
            <div>Notes: {notes?.length || 0}</div>
            <div>Folders: {folders?.length || 0}</div>
            <button
              onClick={() => createNoteMutation.mutate({
                title: 'New Note',
                folder_id: 'folder-1',
              })}
            >
              Create Note
            </button>
            {createNoteMutation.isLoading && <div>Creating...</div>}
            {createNoteMutation.isSuccess && <div>Created!</div>}
          </div>
        );
      };

      // Mock API responses
      server.use(
        http.get('*/api/notes', () => {
          return HttpResponse.json([
            { id: '1', title: 'Existing Note' },
          ]);
        }),
        http.get('*/api/folders', () => {
          return HttpResponse.json([
            { id: 'folder-1', name: 'Folder 1', note_count: 1 },
          ]);
        }),
        http.post('*/api/notes', async ({ request }) => {
          const body = await request.json() as any;
          return HttpResponse.json({
            id: '2',
            ...body,
          });
        })
      );

      render(<CacheManagementTest />, { queryClient });

      // Wait for initial data
      await waitFor(() => {
        expect(screen.getByText('Notes: 1')).toBeInTheDocument();
        expect(screen.getByText('Folders: 1')).toBeInTheDocument();
      });

      // Create new note
      fireEvent.click(screen.getByRole('button', { name: /create note/i }));

      // Cache should update
      await waitFor(() => {
        expect(screen.getByText('Created!')).toBeInTheDocument();
        expect(screen.getByText('Notes: 2')).toBeInTheDocument();
      });
    });

    it('should handle optimistic updates with rollback', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const OptimisticUpdateTest = () => {
        const { data: notes = [] } = ReactQuery.useQuery({
          queryKey: ['notes'],
          queryFn: async () => {
            return [
              { id: '1', title: 'Note 1', completed: false },
              { id: '2', title: 'Note 2', completed: false },
            ];
          },
        });

        const updateNoteMutation = ReactQuery.useMutation({
          mutationFn: async ({ id, completed }: any) => {
            // Simulate API call that might fail
            if (completed && id === '2') {
              throw new Error('Update failed');
            }
            return { id, completed };
          },
          onMutate: async ({ id, completed }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['notes'] });

            // Snapshot previous value
            const previousNotes = queryClient.getQueryData(['notes']);

            // Optimistically update
            queryClient.setQueryData(['notes'], (old: any[]) => {
              return old.map(note => 
                note.id === id ? { ...note, completed } : note
              );
            });

            return { previousNotes };
          },
          onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousNotes) {
              queryClient.setQueryData(['notes'], context.previousNotes);
            }
          },
          onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
          },
        });

        return (
          <div>
            {notes.map((note: any) => (
              <div key={note.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={note.completed}
                    onChange={(e) => updateNoteMutation.mutate({
                      id: note.id,
                      completed: e.target.checked,
                    })}
                  />
                  {note.title}
                </label>
              </div>
            ))}
            {updateNoteMutation.isError && (
              <div>Error: Update failed</div>
            )}
          </div>
        );
      };

      render(<OptimisticUpdateTest />, { queryClient });

      await waitFor(() => {
        expect(screen.getByLabelText('Note 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Note 2')).toBeInTheDocument();
      });

      // Update first note (should succeed)
      const checkbox1 = screen.getByLabelText('Note 1');
      fireEvent.click(checkbox1);

      // Should immediately show as checked
      expect(checkbox1).toBeChecked();

      // Update second note (will fail)
      const checkbox2 = screen.getByLabelText('Note 2');
      fireEvent.click(checkbox2);

      // Should show as checked initially (optimistic)
      expect(checkbox2).toBeChecked();

      // Should rollback after error
      await waitFor(() => {
        expect(screen.getByText('Error: Update failed')).toBeInTheDocument();
        expect(checkbox2).not.toBeChecked();
        expect(checkbox1).toBeChecked(); // First one should remain checked
      });
    });
  });

  describe('Cross-Feature State Updates', () => {
    it('should update UI across features when data changes', async () => {
      const CrossFeatureApp = () => {
        const [notes, setNotes] = React.useState([
          { id: '1', title: 'Note 1', tags: ['work'] },
          { id: '2', title: 'Note 2', tags: ['personal'] },
        ]);

        const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
        const [searchTerm, setSearchTerm] = React.useState('');

        const filteredNotes = notes.filter(note => {
          const matchesTags = selectedTags.length === 0 || 
            note.tags.some(tag => selectedTags.includes(tag));
          const matchesSearch = !searchTerm || 
            note.title.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesTags && matchesSearch;
        });

        const allTags = Array.from(new Set(notes.flatMap(note => note.tags)));
        const tagCounts = allTags.reduce((acc, tag) => {
          acc[tag] = notes.filter(note => note.tags.includes(tag)).length;
          return acc;
        }, {} as Record<string, number>);

        const addTag = (noteId: string, tag: string) => {
          setNotes(prev => prev.map(note => 
            note.id === noteId 
              ? { ...note, tags: [...note.tags, tag] }
              : note
          ));
        };

        return (
          <div>
            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Tag Filter */}
            <div>
              {allTags.map(tag => (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTags([...selectedTags, tag]);
                      } else {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      }
                    }}
                  />
                  {tag} ({tagCounts[tag]})
                </label>
              ))}
            </div>

            {/* Note List */}
            <div>
              <h3>Notes ({filteredNotes.length})</h3>
              {filteredNotes.map(note => (
                <div key={note.id}>
                  {note.title}
                  <span> Tags: {note.tags.join(', ')}</span>
                  <button onClick={() => addTag(note.id, 'important')}>
                    Add Important
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      };

      render(<CrossFeatureApp />);

      // Initial state
      expect(screen.getByText('Notes (2)')).toBeInTheDocument();
      expect(screen.getByText('work (1)')).toBeInTheDocument();
      expect(screen.getByText('personal (1)')).toBeInTheDocument();

      // Filter by tag
      fireEvent.click(screen.getByLabelText('work (1)'));
      expect(screen.getByText('Notes (1)')).toBeInTheDocument();

      // Add tag to filtered note
      fireEvent.click(screen.getByRole('button', { name: /add important/i }));

      // Should update tag counts and show new tag
      await waitFor(() => {
        expect(screen.getByText('important (1)')).toBeInTheDocument();
        expect(screen.getByText(/Tags: work, important/)).toBeInTheDocument();
      });

      // Clear filter to see all notes
      fireEvent.click(screen.getByLabelText('work (1)'));
      expect(screen.getByText('Notes (2)')).toBeInTheDocument();
    });

    it('should handle complex state dependencies', async () => {
      const ComplexStateApp = () => {
        const [user, setUser] = React.useState(mockUser);
        const [preferences, setPreferences] = React.useState({
          theme: 'light',
          autoSave: true,
          syncInterval: 5000,
        });
        const [syncStatus, setSyncStatus] = React.useState('idle');
        const [lastSync, setLastSync] = React.useState<Date | null>(null);

        // Derived state
        const canSync = user !== null && preferences.autoSave;
        const syncIntervalMs = preferences.syncInterval;

        // Auto-sync effect
        React.useEffect(() => {
          if (!canSync) return;

          const sync = async () => {
            setSyncStatus('syncing');
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));
              setLastSync(new Date());
              setSyncStatus('success');
            } catch (error) {
              setSyncStatus('error');
            }
          };

          sync();
          const interval = setInterval(sync, syncIntervalMs);
          return () => clearInterval(interval);
        }, [canSync, syncIntervalMs]);

        return (
          <div>
            <div>User: {user?.email || 'Not logged in'}</div>
            <div>Theme: {preferences.theme}</div>
            <div>Auto-save: {preferences.autoSave ? 'On' : 'Off'}</div>
            <div>Sync Status: {syncStatus}</div>
            {lastSync && <div>Last sync: {lastSync.toLocaleTimeString()}</div>}
            
            <button onClick={() => setUser(null)}>Logout</button>
            <button onClick={() => setPreferences(p => ({ ...p, autoSave: !p.autoSave }))}>
              Toggle Auto-save
            </button>
            <button onClick={() => setPreferences(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))}>
              Toggle Theme
            </button>
          </div>
        );
      };

      render(<ComplexStateApp />);

      // Initial state with auto-sync
      await waitFor(() => {
        expect(screen.getByText('Sync Status: syncing')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Sync Status: success')).toBeInTheDocument();
        expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
      });

      // Disable auto-save
      fireEvent.click(screen.getByRole('button', { name: /toggle auto-save/i }));
      expect(screen.getByText('Auto-save: Off')).toBeInTheDocument();

      // Sync should stop
      const lastSyncText = screen.getByText(/Last sync:/).textContent;
      await new Promise(resolve => setTimeout(resolve, 2000));
      expect(screen.getByText(/Last sync:/).textContent).toBe(lastSyncText);

      // Re-enable auto-save
      fireEvent.click(screen.getByRole('button', { name: /toggle auto-save/i }));
      
      // Should start syncing again
      await waitFor(() => {
        expect(screen.getByText('Sync Status: syncing')).toBeInTheDocument();
      });

      // Logout should stop sync
      fireEvent.click(screen.getByRole('button', { name: /logout/i }));
      expect(screen.getByText('User: Not logged in')).toBeInTheDocument();
    });
  });
});