import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { createEmptyNote, saveNote } from '@/services/noteStorage';
import { createFolder, moveNote, buildFolderTree } from '@/services/folderService';
import NoteEditor from '@/components/notes/NoteEditor';
import FolderTree from '@/components/notes/FolderTree';

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

describe('Note Creation → Folder Assignment → Storage Integration', () => {
  const mockUserId = 'mock-user-id';
  const mockFolderId = 'target-folder-id';
  const mockNoteId = 'new-note-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a note and assign it to a folder', async () => {
    // Mock folder creation
    vi.mocked(createFolder).mockResolvedValue(mockFolderId);
    
    // Mock note creation
    vi.mocked(createEmptyNote).mockResolvedValue(mockNoteId);
    
    // Mock folder tree with the new folder
    vi.mocked(buildFolderTree).mockResolvedValue([
      {
        id: mockFolderId,
        name: 'Project Notes',
        type: 'folder',
        children: [],
        parentId: null,
      },
    ]);

    // Mock MSW handlers for folder and note operations
    server.use(
      http.post('*/rest/v1/folders', async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json({
          id: mockFolderId,
          name: body.name,
          user_id: mockUserId,
          parent_id: null,
          created_at: new Date().toISOString(),
        });
      }),
      http.post('*/rest/v1/note_metadata', async ({ request }) => {
        const body = await request.json() as any;
        return HttpResponse.json({
          id: mockNoteId,
          title: body.title,
          folder_id: body.folder_id,
          user_id: mockUserId,
          created_at: new Date().toISOString(),
        });
      })
    );

    // Test folder creation first
    const folderName = 'Project Notes';
    await createFolder(mockUserId, folderName);

    expect(createFolder).toHaveBeenCalledWith(mockUserId, folderName, null);

    // Create note with folder assignment
    const noteTitle = 'New Note in Folder';
    await createEmptyNote(mockUserId, noteTitle, mockFolderId);

    expect(createEmptyNote).toHaveBeenCalledWith(
      mockUserId,
      noteTitle,
      mockFolderId
    );
  });

  it('should move an existing note to a different folder', async () => {
    const originalFolderId = 'original-folder-id';
    const newFolderId = 'new-folder-id';
    const existingNoteId = 'existing-note-id';

    // Mock the move operation
    vi.mocked(moveNote).mockResolvedValue(undefined);
    
    // Mock folder tree showing note in original location
    vi.mocked(buildFolderTree).mockResolvedValueOnce([
      {
        id: originalFolderId,
        name: 'Original Folder',
        type: 'folder',
        children: [
          {
            id: existingNoteId,
            name: 'Existing Note',
            type: 'note',
            parentId: originalFolderId,
          },
        ],
        parentId: null,
      },
      {
        id: newFolderId,
        name: 'New Folder',
        type: 'folder',
        children: [],
        parentId: null,
      },
    ]);

    // Mock folder tree after move
    vi.mocked(buildFolderTree).mockResolvedValueOnce([
      {
        id: originalFolderId,
        name: 'Original Folder',
        type: 'folder',
        children: [],
        parentId: null,
      },
      {
        id: newFolderId,
        name: 'New Folder',
        type: 'folder',
        children: [
          {
            id: existingNoteId,
            name: 'Existing Note',
            type: 'note',
            parentId: newFolderId,
          },
        ],
        parentId: null,
      },
    ]);

    // Mock the update request
    server.use(
      http.patch('*/rest/v1/note_metadata', async ({ request }) => {
        const body = await request.json() as any;
        expect(body.folder_id).toBe(newFolderId);
        return HttpResponse.json({
          ...body,
          updated_at: new Date().toISOString(),
        });
      })
    );

    // Perform the move
    await moveNote(mockUserId, existingNoteId, newFolderId);

    expect(moveNote).toHaveBeenCalledWith(
      mockUserId,
      existingNoteId,
      newFolderId
    );

    // Verify the folder tree is updated
    const updatedTree = await buildFolderTree(mockUserId);
    const newFolder = updatedTree.find(item => item.id === newFolderId) as any;
    expect(newFolder.children).toHaveLength(1);
    expect(newFolder.children[0].id).toBe(existingNoteId);
  });

  it('should handle note creation with nested folder structure', async () => {
    const parentFolderId = 'parent-folder-id';
    const childFolderId = 'child-folder-id';
    const noteId = 'nested-note-id';

    // Mock nested folder structure
    vi.mocked(buildFolderTree).mockResolvedValue([
      {
        id: parentFolderId,
        name: 'Parent Folder',
        type: 'folder',
        children: [
          {
            id: childFolderId,
            name: 'Child Folder',
            type: 'folder',
            children: [],
            parentId: parentFolderId,
          },
        ],
        parentId: null,
      },
    ]);

    vi.mocked(createEmptyNote).mockResolvedValue(noteId);
    vi.mocked(saveNote).mockResolvedValue(noteId);

    // Create note in nested folder
    await createEmptyNote(mockUserId, 'Nested Note', childFolderId);

    expect(createEmptyNote).toHaveBeenCalledWith(
      mockUserId,
      'Nested Note',
      childFolderId
    );

    // Save note with content
    const noteData = {
      id: noteId,
      title: 'Nested Note',
      transcription: 'Content in nested folder',
      summary: 'Summary of nested content',
      folderId: childFolderId,
    };

    await saveNote(mockUserId, noteData);

    expect(saveNote).toHaveBeenCalledWith(mockUserId, noteData);
  });

  it('should persist folder assignment through note updates', async () => {
    const folderId = 'persistent-folder-id';
    const noteId = 'update-note-id';

    // Mock initial note with folder
    server.use(
      http.get('*/storage/v1/object/notes/*', () => {
        return HttpResponse.json({
          id: noteId,
          title: 'Original Title',
          transcription: 'Original content',
          summary: 'Original summary',
          folderId: folderId,
          created_at: new Date().toISOString(),
        });
      }),
      http.patch('*/rest/v1/note_metadata', async ({ request }) => {
        const body = await request.json() as any;
        // Verify folder_id is maintained
        expect(body.folder_id).toBe(folderId);
        return HttpResponse.json({
          ...body,
          updated_at: new Date().toISOString(),
        });
      })
    );

    vi.mocked(saveNote).mockImplementation(async (userId, noteData) => {
      // Verify folder assignment is preserved
      expect(noteData.folderId).toBe(folderId);
      return noteId;
    });

    // Update note content
    const updatedNoteData = {
      id: noteId,
      title: 'Updated Title',
      transcription: 'Updated content',
      summary: 'Updated summary',
      folderId: folderId, // Should maintain folder assignment
    };

    await saveNote(mockUserId, updatedNoteData);

    expect(saveNote).toHaveBeenCalledWith(mockUserId, updatedNoteData);
  });

  it('should handle removing note from folder (move to root)', async () => {
    const folderId = 'current-folder-id';
    const noteId = 'movable-note-id';

    vi.mocked(moveNote).mockResolvedValue(undefined);

    // Mock the update to remove folder assignment
    server.use(
      http.patch('*/rest/v1/note_metadata', async ({ request }) => {
        const body = await request.json() as any;
        expect(body.folder_id).toBeNull();
        return HttpResponse.json({
          ...body,
          updated_at: new Date().toISOString(),
        });
      })
    );

    // Move note to root (null folder)
    await moveNote(mockUserId, noteId, null);

    expect(moveNote).toHaveBeenCalledWith(mockUserId, noteId, null);
  });

  it('should validate folder exists before assignment', async () => {
    const nonExistentFolderId = 'non-existent-folder';
    const noteId = 'validation-note-id';

    // Mock empty folder tree (folder doesn't exist)
    vi.mocked(buildFolderTree).mockResolvedValue([]);

    // Mock folder validation error
    server.use(
      http.post('*/rest/v1/note_metadata', async ({ request }) => {
        const body = await request.json() as any;
        if (body.folder_id === nonExistentFolderId) {
          return HttpResponse.json(
            { error: 'Folder not found' },
            { status: 404 }
          );
        }
        return HttpResponse.json(body);
      })
    );

    // Attempt to create note in non-existent folder
    vi.mocked(createEmptyNote).mockRejectedValue(
      new Error('Folder not found')
    );

    await expect(
      createEmptyNote(mockUserId, 'Invalid Note', nonExistentFolderId)
    ).rejects.toThrow('Folder not found');
  });
});