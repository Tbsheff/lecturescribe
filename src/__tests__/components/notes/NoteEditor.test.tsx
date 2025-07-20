import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import NoteEditor from '@/components/notes/NoteEditor';

// Mock dependencies
vi.mock('@/services/noteStorage', () => ({
  updateNoteContent: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn()
  }
}));

// Mock react-markdown to avoid complex rendering issues
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>
}));

describe('NoteEditor Component', () => {
  const mockOnSave = vi.fn();
  const defaultProps = {
    noteId: 'test-note-id',
    userId: 'test-user-id',
    initialContent: 'Initial note content',
    onSave: mockOnSave
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with initial content', () => {
    render(<NoteEditor {...defaultProps} />);
    
    // Check tabs are rendered
    expect(screen.getByRole('tab', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    
    // Check initial content is in textarea
    const textarea = screen.getByPlaceholderText('Start writing...');
    expect(textarea).toHaveValue('Initial note content');
    
    // Check save status
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('should render formatting toolbar with all buttons', () => {
    render(<NoteEditor {...defaultProps} />);
    
    // Text formatting buttons
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeInTheDocument();
    expect(screen.getByTitle('Underline (Ctrl+U)')).toBeInTheDocument();
    expect(screen.getByTitle('Strikethrough')).toBeInTheDocument();
    
    // Heading buttons
    expect(screen.getByTitle('Heading 1 (Ctrl+1)')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 2 (Ctrl+2)')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 3 (Ctrl+3)')).toBeInTheDocument();
    
    // List buttons
    expect(screen.getByTitle('Bullet List')).toBeInTheDocument();
    expect(screen.getByTitle('Numbered List')).toBeInTheDocument();
    expect(screen.getByTitle('Checkbox')).toBeInTheDocument();
    
    // Other formatting buttons
    expect(screen.getByTitle('Quote')).toBeInTheDocument();
    expect(screen.getByTitle('Note Callout')).toBeInTheDocument();
    expect(screen.getByTitle('Warning Callout')).toBeInTheDocument();
    expect(screen.getByTitle('Inline Code')).toBeInTheDocument();
    expect(screen.getByTitle('Code Block')).toBeInTheDocument();
    expect(screen.getByTitle('Link (Ctrl+K)')).toBeInTheDocument();
    expect(screen.getByTitle('Image')).toBeInTheDocument();
    expect(screen.getByTitle('Upload Image')).toBeInTheDocument();
  });

  it('should render without initial content', () => {
    render(<NoteEditor {...defaultProps} initialContent="" />);
    
    const textarea = screen.getByPlaceholderText('Start writing...');
    expect(textarea).toHaveValue('');
  });

  it('should have a hidden file input for uploads', () => {
    render(<NoteEditor {...defaultProps} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveClass('hidden');
    expect(fileInput).toHaveAttribute('accept', 'image/*');
  });

  it('should display editor and preview tabs', () => {
    render(<NoteEditor {...defaultProps} />);
    
    const editTab = screen.getByRole('tab', { name: 'Edit' });
    const previewTab = screen.getByRole('tab', { name: 'Preview' });
    
    expect(editTab).toBeInTheDocument();
    expect(previewTab).toBeInTheDocument();
    
    // Edit tab should be selected by default
    expect(editTab).toHaveAttribute('data-state', 'active');
    expect(previewTab).toHaveAttribute('data-state', 'inactive');
  });

  it('should have proper structure for toolbar sections', () => {
    const { container } = render(<NoteEditor {...defaultProps} />);
    
    // Check toolbar has proper sections with dividers
    const toolbar = container.querySelector('[class*="flex-wrap"][class*="gap-1"]');
    expect(toolbar).toBeInTheDocument();
    
    // Check for dividers between button groups
    const dividers = toolbar?.querySelectorAll('[class*="h-4"][class*="w-px"][class*="bg-border"]');
    expect(dividers?.length).toBeGreaterThan(0);
  });

  it('should render textarea with proper classes', () => {
    render(<NoteEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('Start writing...');
    expect(textarea).toHaveClass('flex-1');
    expect(textarea).toHaveClass('min-h-[500px]');
    expect(textarea).toHaveClass('font-mono');
    expect(textarea).toHaveClass('resize-none');
  });

  it('should display save status indicator', () => {
    render(<NoteEditor {...defaultProps} />);
    
    const saveStatus = screen.getByText('Saved');
    expect(saveStatus).toBeInTheDocument();
    expect(saveStatus).toHaveClass('text-xs');
    expect(saveStatus).toHaveClass('text-muted-foreground');
  });

  it('should have all formatting button icons', () => {
    const { container } = render(<NoteEditor {...defaultProps} />);
    
    // Check for specific button contents
    expect(container.querySelector('[title="Bold (Ctrl+B)"] svg')).toBeInTheDocument();
    expect(container.querySelector('[title="Italic (Ctrl+I)"] svg')).toBeInTheDocument();
    expect(container.querySelector('[title="Underline (Ctrl+U)"] svg')).toBeInTheDocument();
    expect(container.querySelector('[title="Strikethrough"] svg')).toBeInTheDocument();
    
    // Check for inline code button with text content
    expect(screen.getByText('`code`')).toBeInTheDocument();
  });

  it('should render with custom initial content', () => {
    const customContent = '# Custom Title\n\nThis is custom content';
    render(<NoteEditor {...defaultProps} initialContent={customContent} />);
    
    const textarea = screen.getByPlaceholderText('Start writing...');
    expect(textarea).toHaveValue(customContent);
  });

  it('should have proper tab panel structure', () => {
    const { container } = render(<NoteEditor {...defaultProps} />);
    
    // Check for tabs component structure
    const tabsList = container.querySelector('[role="tablist"]');
    expect(tabsList).toBeInTheDocument();
    
    // Check for tab panels
    const editPanel = container.querySelector('[role="tabpanel"][data-state="active"]');
    expect(editPanel).toBeInTheDocument();
  });

  it('should have all callout buttons with proper colors', () => {
    render(<NoteEditor {...defaultProps} />);
    
    // Note callout button should have blue color
    const noteCallout = screen.getByTitle('Note Callout');
    const noteIcon = noteCallout.querySelector('svg');
    expect(noteIcon).toHaveClass('text-blue-500');
    
    // Warning callout button should have amber color
    const warningCallout = screen.getByTitle('Warning Callout');
    const warningIcon = warningCallout.querySelector('svg');
    expect(warningIcon).toHaveClass('text-amber-500');
  });
});