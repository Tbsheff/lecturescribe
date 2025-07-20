import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as folderService from '@/services/folderService';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockSingle = vi.fn();

  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(() => ({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            order: mockOrder,
          }),
        }),
        insert: mockInsert.mockReturnValue({
          select: mockSelect.mockReturnValue({
            single: mockSingle,
          }),
        }),
        update: mockUpdate.mockReturnValue({
          eq: mockEq,
        }),
        delete: mockDelete.mockReturnValue({
          eq: mockEq,
        }),
      })),
    },
  };
});

describe.skip('folderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFolders', () => {
    it('should fetch all folders for a user', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockFolders = [
        { id: 'folder-1', name: 'Folder 1', parent_id: null, user_id: 'user-123' },
        { id: 'folder-2', name: 'Folder 2', parent_id: 'folder-1', user_id: 'user-123' },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      
      // Mock the chain to return the folders
      const mockTable = supabase.from('folders');
      const selectChain = mockTable.select('*');
      const eqChain = selectChain.eq('user_id', 'user-123');
      eqChain.order = vi.fn().mockResolvedValue({
        data: mockFolders,
        error: null,
      });

      const result = await folderService.getFolders();

      expect(result).toEqual(mockFolders);
      expect(supabase.from).toHaveBeenCalledWith('folders');
    });

    it('should throw error if user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(folderService.getFolders()).rejects.toThrow('User not authenticated');
    });

    it('should handle database errors', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockSelectError = {
        data: null,
        error: new Error('Database error'),
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue(mockSelectError),
          }),
        }),
      } as any);

      await expect(folderService.getFolders()).rejects.toThrow('Database error');
    });
  });

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockInsert = {
        data: { id: 'new-folder-id', name: 'New Folder', parent_id: null },
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(mockInsert),
          }),
        }),
      } as any);

      const result = await folderService.createFolder('New Folder', null);

      expect(result).toEqual(mockInsert.data);
      const insertCall = vi.mocked(supabase.from).mock.results[0].value.insert;
      expect(insertCall).toHaveBeenCalledWith({
        name: 'New Folder',
        parent_id: null,
        user_id: 'user-123',
      });
    });

    it('should create a subfolder with parent ID', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockInsert = {
        data: { id: 'new-folder-id', name: 'Subfolder', parent_id: 'parent-123' },
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(mockInsert),
          }),
        }),
      } as any);

      const result = await folderService.createFolder('Subfolder', 'parent-123');

      expect(result.parent_id).toBe('parent-123');
    });
  });

  describe('updateFolder', () => {
    it('should update folder name', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpdate = {
        data: { id: 'folder-123', name: 'Updated Name' },
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockUpdate),
          }),
        }),
      } as any);

      await folderService.updateFolder('folder-123', { name: 'Updated Name' });

      const updateCall = vi.mocked(supabase.from).mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({
        name: 'Updated Name',
        updated_at: expect.any(String),
      });
    });

    it('should update folder parent', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpdate = {
        data: { id: 'folder-123', parent_id: 'new-parent-123' },
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockUpdate),
          }),
        }),
      } as any);

      await folderService.updateFolder('folder-123', { parent_id: 'new-parent-123' });

      const updateCall = vi.mocked(supabase.from).mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({
        parent_id: 'new-parent-123',
        updated_at: expect.any(String),
      });
    });
  });

  describe('deleteFolder', () => {
    it('should delete a folder', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockDelete = {
        data: {},
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockDelete),
          }),
        }),
      } as any);

      await folderService.deleteFolder('folder-123');

      expect(supabase.from).toHaveBeenCalledWith('folders');
      const deleteChain = vi.mocked(supabase.from).mock.results[0].value.delete();
      expect(deleteChain.eq).toHaveBeenCalledWith('id', 'folder-123');
    });

    it('should handle deletion errors', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockDeleteError = {
        data: null,
        error: new Error('Delete failed'),
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockDeleteError),
          }),
        }),
      } as any);

      await expect(folderService.deleteFolder('folder-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('moveNoteToFolder', () => {
    it('should move note to a folder', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpdate = {
        data: { id: 'note-123', folder_id: 'folder-456' },
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockUpdate),
          }),
        }),
      } as any);

      await folderService.moveNoteToFolder('note-123', 'folder-456');

      const updateCall = vi.mocked(supabase.from).mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({
        folder_id: 'folder-456',
        updated_at: expect.any(String),
      });
    });

    it('should move note to root when folderId is null', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpdate = {
        data: { id: 'note-123', folder_id: null },
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockUpdate),
          }),
        }),
      } as any);

      await folderService.moveNoteToFolder('note-123', null);

      const updateCall = vi.mocked(supabase.from).mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({
        folder_id: null,
        updated_at: expect.any(String),
      });
    });
  });

  describe('buildFolderTree', () => {
    it('should build hierarchical folder tree with notes', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockFolders = [
        { id: 'folder-1', name: 'Parent', parent_id: null, user_id: 'user-123' },
        { id: 'folder-2', name: 'Child', parent_id: 'folder-1', user_id: 'user-123' },
      ];
      const mockNotes = [
        { id: 'note-1', title: 'Note 1', folder_id: null },
        { id: 'note-2', title: 'Note 2', folder_id: 'folder-1' },
        { id: 'note-3', title: 'Note 3', folder_id: 'folder-2' },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockFolders, error: null }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockNotes, error: null }),
            }),
          }),
        } as any);

      const result = await folderService.buildFolderTree();

      expect(result).toHaveLength(2); // Root folder and root note
      expect(result[0].id).toBe('folder-1');
      expect(result[0].children).toHaveLength(2); // Child folder and note
      expect(result[0].children[0].id).toBe('folder-2');
      expect(result[0].children[0].children).toHaveLength(1); // Note in child folder
      expect(result[1].id).toBe('note-1'); // Root level note
    });

    it('should handle empty folders and notes', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        } as any);

      const result = await folderService.buildFolderTree();

      expect(result).toEqual([]);
    });
  });
});