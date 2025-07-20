import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { NoteList } from '@/components/notes/NoteList';
import { createMockNote } from '@/test/test-utils';

describe('NoteList Component', () => {
  const mockOnNoteClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no notes are provided', () => {
    render(<NoteList notes={[]} onNoteClick={mockOnNoteClick} />);
    
    expect(screen.getByText('No notes yet. Start by recording or uploading audio.')).toBeInTheDocument();
  });

  it('should render a list of notes', () => {
    const mockNotes = [
      {
        id: '1',
        title: 'First Note',
        date: new Date('2024-01-01'),
        preview: 'This is the first note preview'
      },
      {
        id: '2',
        title: 'Second Note',
        date: new Date('2024-01-02'),
        preview: 'This is the second note preview'
      },
      {
        id: '3',
        title: 'Third Note',
        date: new Date('2024-01-03'),
      }
    ];

    render(<NoteList notes={mockNotes} onNoteClick={mockOnNoteClick} />);
    
    // Check that all notes are rendered
    expect(screen.getByText('First Note')).toBeInTheDocument();
    expect(screen.getByText('Second Note')).toBeInTheDocument();
    expect(screen.getByText('Third Note')).toBeInTheDocument();
    
    // Check that previews are shown when available
    expect(screen.getByText('This is the first note preview')).toBeInTheDocument();
    expect(screen.getByText('This is the second note preview')).toBeInTheDocument();
  });

  it('should call onNoteClick when a note is clicked', async () => {
    const user = userEvent.setup();
    const mockNotes = [
      {
        id: 'note-1',
        title: 'Clickable Note',
        date: new Date('2024-01-01'),
        preview: 'Click me!'
      }
    ];

    render(<NoteList notes={mockNotes} onNoteClick={mockOnNoteClick} />);
    
    const noteCard = screen.getByText('Clickable Note').closest('[class*="card"]');
    expect(noteCard).toBeInTheDocument();
    
    await user.click(noteCard!);
    
    expect(mockOnNoteClick).toHaveBeenCalledWith('note-1');
    expect(mockOnNoteClick).toHaveBeenCalledTimes(1);
  });

  it('should render multiple notes and handle clicks independently', async () => {
    const user = userEvent.setup();
    const mockNotes = [
      {
        id: 'note-1',
        title: 'First Note',
        date: new Date('2024-01-01'),
      },
      {
        id: 'note-2',
        title: 'Second Note',
        date: new Date('2024-01-02'),
      }
    ];

    render(<NoteList notes={mockNotes} onNoteClick={mockOnNoteClick} />);
    
    // Click first note
    const firstNote = screen.getByText('First Note').closest('[class*="card"]');
    await user.click(firstNote!);
    expect(mockOnNoteClick).toHaveBeenCalledWith('note-1');
    
    // Click second note
    const secondNote = screen.getByText('Second Note').closest('[class*="card"]');
    await user.click(secondNote!);
    expect(mockOnNoteClick).toHaveBeenCalledWith('note-2');
    
    expect(mockOnNoteClick).toHaveBeenCalledTimes(2);
  });

  it('should handle notes with invalid dates gracefully', () => {
    const mockNotes = [
      {
        id: '1',
        title: 'Note with invalid date',
        date: new Date('invalid-date'),
      },
      {
        id: '2',
        title: 'Note with null date',
        date: null as any,
      }
    ];

    render(<NoteList notes={mockNotes} onNoteClick={mockOnNoteClick} />);
    
    // Should still render the notes
    expect(screen.getByText('Note with invalid date')).toBeInTheDocument();
    expect(screen.getByText('Note with null date')).toBeInTheDocument();
    
    // Should show fallback text for dates
    const dateTexts = screen.getAllByText('Date unavailable');
    expect(dateTexts).toHaveLength(2);
  });

  it('should render notes with proper spacing', () => {
    const mockNotes = Array.from({ length: 3 }, (_, i) => ({
      id: `note-${i}`,
      title: `Note ${i + 1}`,
      date: new Date(),
    }));

    const { container } = render(<NoteList notes={mockNotes} onNoteClick={mockOnNoteClick} />);
    
    // Check that the container has the space-y-3 class for spacing
    const listContainer = container.querySelector('.space-y-3');
    expect(listContainer).toBeInTheDocument();
    expect(listContainer?.children).toHaveLength(3);
  });

  it('should maintain consistent rendering with mixed note data', () => {
    const mockNotes = [
      {
        id: '1',
        title: 'Complete Note',
        date: new Date('2024-01-01'),
        preview: 'This note has all fields'
      },
      {
        id: '2',
        title: 'Minimal Note',
        date: new Date('2024-01-02'),
      },
      {
        id: '3',
        title: 'Note with Long Preview',
        date: new Date('2024-01-03'),
        preview: 'This is a very long preview text that should be truncated by the line-clamp-2 class to ensure consistent card heights across all notes in the list'
      }
    ];

    render(<NoteList notes={mockNotes} onNoteClick={mockOnNoteClick} />);
    
    // All notes should be rendered
    expect(screen.getByText('Complete Note')).toBeInTheDocument();
    expect(screen.getByText('Minimal Note')).toBeInTheDocument();
    expect(screen.getByText('Note with Long Preview')).toBeInTheDocument();
    
    // Check previews
    expect(screen.getByText('This note has all fields')).toBeInTheDocument();
    expect(screen.getByText(/This is a very long preview text/)).toBeInTheDocument();
  });
});