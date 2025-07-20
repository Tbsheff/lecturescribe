import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { listNotes } from '@/services/noteStorage';
import { buildFolderTree } from '@/services/folderService';
import NotesView from '@/pages/NotesView';
import NoteList from '@/components/notes/NoteList';

// Mock the services
vi.mock('@/services/noteStorage');
vi.mock('@/services/folderService');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id' } },
        error: null,
      }),
    },
  },
}));

describe('Search → Filter → Display Results Integration', () => {
  const mockUserId = 'mock-user-id';
  
  const mockNotes = [
    {
      id: 'note-1',
      user_id: mockUserId,
      title: 'JavaScript Tutorial',
      preview: 'Learn JavaScript basics including variables, functions, and objects',
      created_at: new Date('2024-01-15').toISOString(),
      updated_at: new Date('2024-01-15').toISOString(),
      note_path: 'notes/note-1.json',
      folder_id: 'folder-1',
    },
    {
      id: 'note-2',
      user_id: mockUserId,
      title: 'Python Guide',
      preview: 'Introduction to Python programming with examples',
      created_at: new Date('2024-01-10').toISOString(),
      updated_at: new Date('2024-01-10').toISOString(),
      note_path: 'notes/note-2.json',
      folder_id: 'folder-2',
    },
    {
      id: 'note-3',
      user_id: mockUserId,
      title: 'React Best Practices',
      preview: 'Advanced React patterns and performance optimization techniques',
      created_at: new Date('2024-01-20').toISOString(),
      updated_at: new Date('2024-01-20').toISOString(),
      note_path: 'notes/note-3.json',
      folder_id: 'folder-1',
    },
    {
      id: 'note-4',
      user_id: mockUserId,
      title: 'Database Design',
      preview: 'Fundamentals of relational database design and SQL',
      created_at: new Date('2024-01-05').toISOString(),
      updated_at: new Date('2024-01-05').toISOString(),
      note_path: 'notes/note-4.json',
      folder_id: null,
    },
  ];

  const mockFolderTree = [
    {
      id: 'folder-1',
      name: 'Web Development',
      type: 'folder' as const,
      children: [
        {
          id: 'note-1',
          name: 'JavaScript Tutorial',
          type: 'note' as const,
          parentId: 'folder-1',
        },
        {
          id: 'note-3',
          name: 'React Best Practices',
          type: 'note' as const,
          parentId: 'folder-1',
        },
      ],
      parentId: null,
    },
    {
      id: 'folder-2',
      name: 'Backend',
      type: 'folder' as const,
      children: [
        {
          id: 'note-2',
          name: 'Python Guide',
          type: 'note' as const,
          parentId: 'folder-2',
        },
      ],
      parentId: null,
    },
    {
      id: 'note-4',
      name: 'Database Design',
      type: 'note' as const,
      parentId: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listNotes).mockResolvedValue(mockNotes);
    vi.mocked(buildFolderTree).mockResolvedValue(mockFolderTree);
  });

  it('should search notes by title and display filtered results', async () => {
    render(<NoteList notes={mockNotes} onNoteSelect={vi.fn()} />);

    // Wait for notes to load
    await waitFor(() => {
      expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
      expect(screen.getByText('Python Guide')).toBeInTheDocument();
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
      expect(screen.getByText('Database Design')).toBeInTheDocument();
    });

    // Find and use search input
    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'React' } });

    // Should only show matching notes
    await waitFor(() => {
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
      expect(screen.queryByText('JavaScript Tutorial')).not.toBeInTheDocument();
      expect(screen.queryByText('Python Guide')).not.toBeInTheDocument();
      expect(screen.queryByText('Database Design')).not.toBeInTheDocument();
    });
  });

  it('should search notes by content/preview and display results', async () => {
    render(<NoteList notes={mockNotes} onNoteSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(4);
    });

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'optimization' } });

    // Should find note with 'optimization' in preview
    await waitFor(() => {
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
      expect(screen.getByText(/performance optimization techniques/i)).toBeInTheDocument();
      expect(screen.queryByText('JavaScript Tutorial')).not.toBeInTheDocument();
    });
  });

  it('should filter notes by folder and combine with search', async () => {
    const mockOnNoteSelect = vi.fn();
    
    // Mock component that integrates search and folder filtering
    const FilterableNoteList = () => {
      const [notes, setNotes] = React.useState(mockNotes);
      const [searchTerm, setSearchTerm] = React.useState('');
      const [selectedFolder, setSelectedFolder] = React.useState<string | null>(null);

      const filteredNotes = notes.filter(note => {
        const matchesSearch = !searchTerm || 
          note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          note.preview.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesFolder = !selectedFolder || note.folder_id === selectedFolder;
        
        return matchesSearch && matchesFolder;
      });

      return (
        <div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select onChange={(e) => setSelectedFolder(e.target.value || null)}>
            <option value="">All Folders</option>
            <option value="folder-1">Web Development</option>
            <option value="folder-2">Backend</option>
          </select>
          <div>
            {filteredNotes.map(note => (
              <article key={note.id}>
                <h3>{note.title}</h3>
                <p>{note.preview}</p>
              </article>
            ))}
          </div>
        </div>
      );
    };

    render(<FilterableNoteList />);

    // Initially all notes are shown
    expect(screen.getAllByRole('article')).toHaveLength(4);

    // Filter by folder
    const folderSelect = screen.getByRole('combobox');
    fireEvent.change(folderSelect, { target: { value: 'folder-1' } });

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
    });

    // Add search term
    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'JavaScript' } });

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
      expect(screen.queryByText('React Best Practices')).not.toBeInTheDocument();
    });
  });

  it('should sort search results by relevance and date', async () => {
    // Add relevance scores to mock data
    const searchTerm = 'JavaScript';
    const notesWithRelevance = mockNotes.map(note => ({
      ...note,
      relevance: note.title.toLowerCase().includes(searchTerm.toLowerCase()) ? 2 :
                 note.preview.toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0
    }));

    // Component that sorts by relevance then date
    const SortedNoteList = () => {
      const [searchTerm, setSearchTerm] = React.useState('');
      
      const sortedNotes = React.useMemo(() => {
        if (!searchTerm) return [...mockNotes].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return mockNotes
          .filter(note => 
            note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.preview.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .sort((a, b) => {
            // Sort by title match first, then preview match, then date
            const aInTitle = a.title.toLowerCase().includes(searchTerm.toLowerCase());
            const bInTitle = b.title.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (aInTitle && !bInTitle) return -1;
            if (!aInTitle && bInTitle) return 1;
            
            // If same relevance, sort by date
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
      }, [searchTerm]);

      return (
        <div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div>
            {sortedNotes.map((note, index) => (
              <article key={note.id} data-testid={`note-${index}`}>
                <h3>{note.title}</h3>
                <p>{note.preview}</p>
              </article>
            ))}
          </div>
        </div>
      );
    };

    render(<SortedNoteList />);

    // Search for JavaScript
    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'JavaScript' } });

    await waitFor(() => {
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(2); // JavaScript Tutorial and a note mentioning JavaScript in preview
      
      // JavaScript Tutorial should be first (title match)
      expect(articles[0]).toHaveTextContent('JavaScript Tutorial');
    });
  });

  it('should handle empty search results gracefully', async () => {
    render(<NoteList notes={mockNotes} onNoteSelect={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistentterm123' } });

    await waitFor(() => {
      expect(screen.getByText(/no notes found/i)).toBeInTheDocument();
    });
  });

  it('should persist search and filter state across component updates', async () => {
    const TestComponent = () => {
      const [notes, setNotes] = React.useState(mockNotes);
      const [searchTerm, setSearchTerm] = React.useState('');
      const [updateCount, setUpdateCount] = React.useState(0);

      const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.preview.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return (
        <div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={() => setUpdateCount(c => c + 1)}>
            Update ({updateCount})
          </button>
          <div>
            Results: {filteredNotes.length}
            {filteredNotes.map(note => (
              <article key={note.id}>
                <h3>{note.title}</h3>
              </article>
            ))}
          </div>
        </div>
      );
    };

    render(<TestComponent />);

    // Set search term
    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'React' } });

    await waitFor(() => {
      expect(screen.getByText('Results: 1')).toBeInTheDocument();
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
    });

    // Trigger component update
    const updateButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(updateButton);

    // Search state should persist
    await waitFor(() => {
      expect(screen.getByText('Update (1)')).toBeInTheDocument();
      expect(screen.getByText('Results: 1')).toBeInTheDocument();
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
      expect(searchInput).toHaveValue('React');
    });
  });

  it('should integrate search with real-time updates', async () => {
    const TestComponent = () => {
      const [notes, setNotes] = React.useState(mockNotes);
      const [searchTerm, setSearchTerm] = React.useState('');

      const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const addNewNote = () => {
        const newNote = {
          id: 'note-5',
          user_id: mockUserId,
          title: 'New React Hooks Guide',
          preview: 'Understanding React Hooks',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          note_path: 'notes/note-5.json',
          folder_id: 'folder-1',
        };
        setNotes(prev => [...prev, newNote]);
      };

      return (
        <div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={addNewNote}>Add New Note</button>
          <div>
            {filteredNotes.map(note => (
              <article key={note.id}>
                <h3>{note.title}</h3>
              </article>
            ))}
          </div>
        </div>
      );
    };

    render(<TestComponent />);

    // Search for React
    const searchInput = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(searchInput, { target: { value: 'React' } });

    await waitFor(() => {
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });

    // Add new note that matches search
    const addButton = screen.getByRole('button', { name: /add new note/i });
    fireEvent.click(addButton);

    // New note should appear in filtered results
    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(screen.getByText('React Best Practices')).toBeInTheDocument();
      expect(screen.getByText('New React Hooks Guide')).toBeInTheDocument();
    });
  });

  it('should handle search with special characters and edge cases', async () => {
    const specialNotes = [
      ...mockNotes,
      {
        id: 'note-special',
        user_id: mockUserId,
        title: 'C++ & C# Comparison',
        preview: 'Comparing C++ and C# languages (with examples)',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        note_path: 'notes/note-special.json',
        folder_id: null,
      },
    ];

    render(<NoteList notes={specialNotes} onNoteSelect={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/search notes/i);
    
    // Search with special characters
    fireEvent.change(searchInput, { target: { value: 'C++' } });

    await waitFor(() => {
      expect(screen.getByText('C++ & C# Comparison')).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });

    // Search with parentheses
    fireEvent.change(searchInput, { target: { value: '(with examples)' } });

    await waitFor(() => {
      expect(screen.getByText('C++ & C# Comparison')).toBeInTheDocument();
    });
  });
});