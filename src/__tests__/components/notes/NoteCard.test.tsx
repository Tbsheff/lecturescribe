import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { NoteCard } from '@/components/notes/NoteCard';
import { formatDistanceToNow } from 'date-fns';

// Mock date-fns to have consistent test output
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn()
}));

describe('NoteCard Component', () => {
  const mockOnClick = vi.fn();
  const mockFormatDistanceToNow = vi.mocked(formatDistanceToNow);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFormatDistanceToNow.mockReturnValue('2 days ago');
  });

  it('should render note with all fields', () => {
    const mockNote = {
      id: 'note-1',
      title: 'Test Note Title',
      date: new Date('2024-01-01'),
      preview: 'This is a preview of the note content'
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    // Check title
    expect(screen.getByText('Test Note Title')).toBeInTheDocument();
    
    // Check date formatting was called
    expect(mockFormatDistanceToNow).toHaveBeenCalledWith(mockNote.date, { addSuffix: true });
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
    
    // Check preview
    expect(screen.getByText('This is a preview of the note content')).toBeInTheDocument();
    
    // Check icons are rendered
    expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
    expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
  });

  it('should render note without preview', () => {
    const mockNote = {
      id: 'note-2',
      title: 'Note Without Preview',
      date: new Date('2024-01-02'),
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    expect(screen.getByText('Note Without Preview')).toBeInTheDocument();
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
    
    // Check that no preview paragraph exists
    const previewElements = screen.queryAllByText((content, element) => {
      return element?.tagName === 'P' && element?.classList.contains('line-clamp-2');
    });
    expect(previewElements).toHaveLength(0);
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const mockNote = {
      id: 'clickable-note',
      title: 'Clickable Note',
      date: new Date(),
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    const card = screen.getByText('Clickable Note').closest('[class*="card"]');
    expect(card).toBeInTheDocument();
    
    await user.click(card!);
    
    expect(mockOnClick).toHaveBeenCalledWith('clickable-note');
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should handle invalid date gracefully', () => {
    const mockNote = {
      id: 'note-3',
      title: 'Note with Invalid Date',
      date: new Date('invalid'),
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    expect(screen.getByText('Note with Invalid Date')).toBeInTheDocument();
    expect(screen.getByText('Date unavailable')).toBeInTheDocument();
  });

  it('should handle null date', () => {
    const mockNote = {
      id: 'note-4',
      title: 'Note with Null Date',
      date: null as any,
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    expect(screen.getByText('Note with Null Date')).toBeInTheDocument();
    expect(screen.getByText('Date unavailable')).toBeInTheDocument();
  });

  it('should handle undefined date', () => {
    const mockNote = {
      id: 'note-5',
      title: 'Note with Undefined Date',
      date: undefined as any,
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    expect(screen.getByText('Note with Undefined Date')).toBeInTheDocument();
    expect(screen.getByText('Date unavailable')).toBeInTheDocument();
  });

  it('should apply hover styles', async () => {
    const user = userEvent.setup();
    const mockNote = {
      id: 'hover-note',
      title: 'Hoverable Note',
      date: new Date(),
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    const card = screen.getByText('Hoverable Note').closest('[class*="card"]');
    expect(card).toBeInTheDocument();
    
    // Check that card has hover classes
    expect(card).toHaveClass('cursor-pointer');
    expect(card).toHaveClass('hover:border-brand/30');
    expect(card).toHaveClass('transition-all');
  });

  it('should truncate long titles', () => {
    const mockNote = {
      id: 'note-6',
      title: 'This is a very long note title that should be truncated to prevent layout issues in the card component',
      date: new Date(),
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    const titleElement = screen.getByText(mockNote.title);
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveClass('truncate');
  });

  it('should apply line clamp to preview text', () => {
    const mockNote = {
      id: 'note-7',
      title: 'Note with Long Preview',
      date: new Date(),
      preview: 'This is a very long preview text that should be clamped to two lines to maintain consistent card heights. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    const previewElement = screen.getByText(mockNote.preview);
    expect(previewElement).toBeInTheDocument();
    expect(previewElement).toHaveClass('line-clamp-2');
  });

  it('should render with correct icon colors and styling', () => {
    const mockNote = {
      id: 'note-8',
      title: 'Styled Note',
      date: new Date(),
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    // Check FileText icon container styling
    const iconContainer = screen.getByTestId('file-text-icon').parentElement;
    expect(iconContainer).toHaveClass('bg-secondary');
    expect(iconContainer).toHaveClass('rounded-md');
    expect(iconContainer).toHaveClass('p-2');
    
    // Check FileText icon styling
    const fileIcon = screen.getByTestId('file-text-icon');
    expect(fileIcon).toHaveClass('text-brand');
    
    // Check ChevronRight icon styling
    const chevronIcon = screen.getByTestId('chevron-right-icon');
    expect(chevronIcon).toHaveClass('text-muted-foreground');
  });

  it('should handle rapid clicks without issues', async () => {
    const user = userEvent.setup({ delay: null });
    const mockNote = {
      id: 'rapid-click-note',
      title: 'Rapid Click Test',
      date: new Date(),
    };

    render(<NoteCard note={mockNote} onClick={mockOnClick} />);
    
    const card = screen.getByText('Rapid Click Test').closest('[class*="card"]');
    expect(card).toBeInTheDocument();
    
    // Perform multiple rapid clicks
    await user.click(card!);
    await user.click(card!);
    await user.click(card!);
    
    expect(mockOnClick).toHaveBeenCalledTimes(3);
    expect(mockOnClick).toHaveBeenCalledWith('rapid-click-note');
  });

  it('should maintain consistent layout with different content combinations', () => {
    const testCases = [
      {
        id: '1',
        title: 'Short',
        date: new Date(),
      },
      {
        id: '2',
        title: 'Medium length title here',
        date: new Date(),
        preview: 'With preview'
      },
      {
        id: '3',
        title: 'A much longer title that might need truncation',
        date: new Date(),
        preview: 'And a much longer preview text that will definitely need to be clamped'
      }
    ];

    testCases.forEach((note) => {
      const { container } = render(<NoteCard note={note} onClick={mockOnClick} />);
      
      // Check that card maintains consistent structure
      const card = container.querySelector('[class*="card"]');
      expect(card).toBeInTheDocument();
      
      const cardContent = card?.querySelector('[class*="p-4"]');
      expect(cardContent).toBeInTheDocument();
      expect(cardContent).toHaveClass('flex');
      expect(cardContent).toHaveClass('items-center');
    });
  });
});