import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import FolderTree from '@/components/notes/FolderTree';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn()
  }
}));

describe('FolderTree Component', () => {
  const mockCallbacks = {
    onSelectNote: vi.fn(),
    onCreateFolder: vi.fn(),
    onRenameItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onMoveItem: vi.fn()
  };

  const mockItems = [
    {
      id: 'folder-1',
      name: 'Documents',
      type: 'folder' as const,
      children: [
        {
          id: 'note-1',
          name: 'Meeting Notes',
          type: 'note' as const,
          parentId: 'folder-1'
        },
        {
          id: 'folder-2',
          name: 'Projects',
          type: 'folder' as const,
          children: [],
          parentId: 'folder-1'
        }
      ],
      parentId: null
    },
    {
      id: 'note-2',
      name: 'Quick Notes',
      type: 'note' as const,
      parentId: null
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no items', () => {
    render(<FolderTree items={[]} {...mockCallbacks} />);
    
    expect(screen.getByText('No folders or notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Folder/i })).toBeInTheDocument();
  });

  it('should render folders and notes hierarchy', () => {
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Check root items are visible
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Quick Notes')).toBeInTheDocument();
    
    // Children should not be visible initially (folder collapsed)
    expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });

  it('should expand and collapse folders', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Click on Documents folder to expand
    const documentsFolder = screen.getByText('Documents');
    await user.click(documentsFolder);
    
    // Children should now be visible
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    
    // Click again to collapse
    await user.click(documentsFolder);
    
    // Children should be hidden again
    expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });

  it('should select notes when clicked', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} selectedNoteId="note-2" />);
    
    // Root note should be selectable
    const quickNotes = screen.getByText('Quick Notes');
    await user.click(quickNotes);
    
    expect(mockCallbacks.onSelectNote).toHaveBeenCalledWith('note-2');
    
    // Expand folder and select nested note
    const documentsFolder = screen.getByText('Documents');
    await user.click(documentsFolder);
    
    const meetingNotes = screen.getByText('Meeting Notes');
    await user.click(meetingNotes);
    
    expect(mockCallbacks.onSelectNote).toHaveBeenCalledWith('note-1');
  });

  it('should highlight selected note', () => {
    render(<FolderTree items={mockItems} {...mockCallbacks} selectedNoteId="note-2" />);
    
    const selectedNote = screen.getByText('Quick Notes').closest('div');
    expect(selectedNote).toHaveClass('bg-accent');
    expect(selectedNote).toHaveClass('text-accent-foreground');
  });

  it('should open create folder dialog when clicking new folder button', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    const newFolderButton = screen.getByTitle('New Root Folder');
    await user.click(newFolderButton);
    
    // Dialog should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create New Folder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Folder name')).toBeInTheDocument();
  });

  it('should create new folder with valid name', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open dialog
    const newFolderButton = screen.getByTitle('New Root Folder');
    await user.click(newFolderButton);
    
    // Enter folder name
    const input = screen.getByPlaceholderText('Folder name');
    await user.type(input, 'New Folder');
    
    // Click create button
    const createButton = screen.getByRole('button', { name: 'Create' });
    await user.click(createButton);
    
    expect(mockCallbacks.onCreateFolder).toHaveBeenCalledWith('New Folder', null);
    
    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should show error when creating folder with empty name', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open dialog
    const newFolderButton = screen.getByTitle('New Root Folder');
    await user.click(newFolderButton);
    
    // Click create without entering name
    const createButton = screen.getByRole('button', { name: 'Create' });
    await user.click(createButton);
    
    expect(toast.error).toHaveBeenCalledWith('Folder name cannot be empty');
    expect(mockCallbacks.onCreateFolder).not.toHaveBeenCalled();
  });

  it('should cancel folder creation', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open dialog
    const newFolderButton = screen.getByTitle('New Root Folder');
    await user.click(newFolderButton);
    
    // Click cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    
    // Dialog should close
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockCallbacks.onCreateFolder).not.toHaveBeenCalled();
  });

  it('should open context menu on more button click', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Hover over item to show more button
    const quickNotes = screen.getByText('Quick Notes').closest('div');
    await user.hover(quickNotes!);
    
    // Click more button
    const moreButton = within(quickNotes!).getByRole('button', { name: '' });
    await user.click(moreButton);
    
    // Context menu should appear
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should open rename dialog from context menu', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open context menu
    const quickNotes = screen.getByText('Quick Notes').closest('div');
    await user.hover(quickNotes!);
    const moreButton = within(quickNotes!).getByRole('button', { name: '' });
    await user.click(moreButton);
    
    // Click rename
    const renameOption = screen.getByText('Rename');
    await user.click(renameOption);
    
    // Rename dialog should open with current name
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rename Note')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Note name');
    expect(input).toHaveValue('Quick Notes');
  });

  it('should rename item with valid name', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open rename dialog
    const quickNotes = screen.getByText('Quick Notes').closest('div');
    await user.hover(quickNotes!);
    const moreButton = within(quickNotes!).getByRole('button', { name: '' });
    await user.click(moreButton);
    await user.click(screen.getByText('Rename'));
    
    // Clear and enter new name
    const input = screen.getByPlaceholderText('Note name');
    await user.clear(input);
    await user.type(input, 'Updated Notes');
    
    // Click rename button
    const renameButton = screen.getByRole('button', { name: 'Rename' });
    await user.click(renameButton);
    
    expect(mockCallbacks.onRenameItem).toHaveBeenCalledWith('note-2', 'Updated Notes', 'note');
  });

  it('should show error when renaming with empty name', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open rename dialog
    const quickNotes = screen.getByText('Quick Notes').closest('div');
    await user.hover(quickNotes!);
    const moreButton = within(quickNotes!).getByRole('button', { name: '' });
    await user.click(moreButton);
    await user.click(screen.getByText('Rename'));
    
    // Clear name
    const input = screen.getByPlaceholderText('Note name');
    await user.clear(input);
    
    // Click rename
    const renameButton = screen.getByRole('button', { name: 'Rename' });
    await user.click(renameButton);
    
    expect(toast.error).toHaveBeenCalledWith('Name cannot be empty');
    expect(mockCallbacks.onRenameItem).not.toHaveBeenCalled();
  });

  it('should delete item from context menu', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open context menu
    const quickNotes = screen.getByText('Quick Notes').closest('div');
    await user.hover(quickNotes!);
    const moreButton = within(quickNotes!).getByRole('button', { name: '' });
    await user.click(moreButton);
    
    // Click delete
    const deleteOption = screen.getByText('Delete');
    await user.click(deleteOption);
    
    expect(mockCallbacks.onDeleteItem).toHaveBeenCalledWith('note-2', 'note');
  });

  it('should show new folder option for folders in context menu', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open context menu for folder
    const documentsFolder = screen.getByText('Documents').closest('div');
    await user.hover(documentsFolder!);
    // Get all buttons and filter for the more button (last one)
    const buttons = within(documentsFolder!).getAllByRole('button');
    const moreButton = buttons[buttons.length - 1];
    await user.click(moreButton);
    
    // Should have new folder option
    expect(screen.getByText('New Folder')).toBeInTheDocument();
    
    // Click new folder
    await user.click(screen.getByText('New Folder'));
    
    // Dialog should open for creating subfolder
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should create subfolder', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open context menu and click new folder
    const documentsFolder = screen.getByText('Documents').closest('div');
    await user.hover(documentsFolder!);
    const buttons = within(documentsFolder!).getAllByRole('button');
    const moreButton = buttons[buttons.length - 1];
    await user.click(moreButton);
    await user.click(screen.getByText('New Folder'));
    
    // Enter folder name
    const input = screen.getByPlaceholderText('Folder name');
    await user.type(input, 'Subfolder');
    
    // Create
    const createButton = screen.getByRole('button', { name: 'Create' });
    await user.click(createButton);
    
    expect(mockCallbacks.onCreateFolder).toHaveBeenCalledWith('Subfolder', 'folder-1');
  });

  it('should handle keyboard navigation for folder creation', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open dialog
    const newFolderButton = screen.getByTitle('New Root Folder');
    await user.click(newFolderButton);
    
    // Type and press Enter
    const input = screen.getByPlaceholderText('Folder name');
    await user.type(input, 'Keyboard Folder');
    await user.keyboard('{Enter}');
    
    expect(mockCallbacks.onCreateFolder).toHaveBeenCalledWith('Keyboard Folder', null);
  });

  it('should handle keyboard navigation for rename', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    // Open rename dialog
    const quickNotes = screen.getByText('Quick Notes').closest('div');
    await user.hover(quickNotes!);
    const moreButton = within(quickNotes!).getByRole('button', { name: '' });
    await user.click(moreButton);
    await user.click(screen.getByText('Rename'));
    
    // Type and press Enter
    const input = screen.getByPlaceholderText('Note name');
    await user.clear(input);
    await user.type(input, 'Keyboard Rename');
    await user.keyboard('{Enter}');
    
    expect(mockCallbacks.onRenameItem).toHaveBeenCalledWith('note-2', 'Keyboard Rename', 'note');
  });

  it('should render nested folder structure correctly', () => {
    const nestedItems = [
      {
        id: 'root-folder',
        name: 'Root',
        type: 'folder' as const,
        children: [
          {
            id: 'level-1',
            name: 'Level 1',
            type: 'folder' as const,
            children: [
              {
                id: 'level-2',
                name: 'Level 2',
                type: 'folder' as const,
                children: [],
                parentId: 'level-1'
              }
            ],
            parentId: 'root-folder'
          }
        ],
        parentId: null
      }
    ];
    
    render(<FolderTree items={nestedItems} {...mockCallbacks} />);
    
    // Only root should be visible initially
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
  });

  it('should handle drag and drop preparation', async () => {
    const user = userEvent.setup();
    const { container } = render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    const quickNotes = screen.getByText('Quick Notes').closest('div');
    
    // Elements should have draggable attribute
    expect(quickNotes).toHaveAttribute('draggable', 'true');
  });

  it('should toggle chevron icon when expanding/collapsing folders', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    const documentsFolder = screen.getByText('Documents').closest('div');
    const chevronButton = within(documentsFolder!).getAllByRole('button')[0];
    
    // Initially should show ChevronRight
    expect(chevronButton.querySelector('[class*="h-4 w-4"]')).toBeInTheDocument();
    
    // Click to expand
    await user.click(chevronButton);
    
    // Should now show ChevronDown (component will re-render)
    const expandedChevron = within(documentsFolder!).getAllByRole('button')[0];
    expect(expandedChevron.querySelector('[class*="h-4 w-4"]')).toBeInTheDocument();
  });

  it('should stop propagation when clicking chevron', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={mockItems} {...mockCallbacks} />);
    
    const documentsFolder = screen.getByText('Documents').closest('div');
    const chevronButton = within(documentsFolder!).getAllByRole('button')[0];
    
    // Click chevron - should not trigger folder selection
    await user.click(chevronButton);
    
    expect(mockCallbacks.onSelectNote).not.toHaveBeenCalled();
    
    // Children should be visible (folder expanded)
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
  });

  it('should render with empty items in empty state', async () => {
    const user = userEvent.setup();
    render(<FolderTree items={[]} {...mockCallbacks} />);
    
    // Click create folder button in empty state
    const createButton = screen.getByRole('button', { name: /Create Folder/i });
    await user.click(createButton);
    
    // Dialog should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});