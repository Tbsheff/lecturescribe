import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as noteStorage from '@/services/noteStorage';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client');

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

// Import supabase after mocking
import { supabase } from '@/integrations/supabase/client';

describe.skip('noteStorage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEmptyNote', () => {
    it('should create an empty note with default values', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpload = { data: { path: 'notes/mock-uuid/note.json' }, error: null };
      const mockInsert = { data: { id: 'mock-uuid' }, error: null };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue(mockUpload),
      } as any);
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue(mockInsert),
      } as any);

      const result = await noteStorage.createEmptyNote('My New Note', 'folder-123');

      expect(result).toBe('mock-uuid');
      expect(supabase.storage.from).toHaveBeenCalledWith('notes');
      expect(supabase.from).toHaveBeenCalledWith('note_metadata');
    });

    it('should create note without folder when folderId is null', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpload = { data: { path: 'notes/mock-uuid/note.json' }, error: null };
      const mockInsert = { data: { id: 'mock-uuid' }, error: null };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue(mockUpload),
      } as any);
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue(mockInsert),
      } as any);

      const result = await noteStorage.createEmptyNote('My New Note', null);

      expect(result).toBe('mock-uuid');
      const insertCall = vi.mocked(supabase.from).mock.results[0].value.insert;
      expect(insertCall).toHaveBeenCalledWith(expect.objectContaining({
        folder_id: null,
      }));
    });

    it('should throw error if user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(noteStorage.createEmptyNote('Test Note')).rejects.toThrow('User not authenticated');
    });
  });

  describe('saveNote', () => {
    const mockNoteData = {
      id: 'note-123',
      title: 'Test Note',
      transcription: 'This is a test transcription',
      summary: 'This is a test summary',
      audioUrl: 'https://example.com/audio.mp3',
      structuredSummary: { summary: 'Structured summary' },
    };

    it('should save note with all data', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpload = { data: { path: 'notes/note-123/note.json' }, error: null };
      const mockUpsert = { data: { id: 'note-123' }, error: null };
      const mockCopy = { data: {}, error: null };
      const mockPublicUrl = { data: { publicUrl: 'https://public-url.com/audio.mp3' } };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue(mockUpload),
        copy: vi.fn().mockResolvedValue(mockCopy),
        getPublicUrl: vi.fn().mockReturnValue(mockPublicUrl),
      } as any);
      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockResolvedValue(mockUpsert),
      } as any);

      await noteStorage.saveNote(mockNoteData);

      expect(supabase.storage.from).toHaveBeenCalledWith('notes');
      const uploadCall = vi.mocked(supabase.storage.from).mock.results[0].value.upload;
      expect(uploadCall).toHaveBeenCalledWith(
        'note-123/note.json',
        expect.any(String),
        { contentType: 'application/json', upsert: true }
      );
    });

    it('should save note without audio URL', async () => {
      const noteWithoutAudio = { ...mockNoteData, audioUrl: null };
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpload = { data: { path: 'notes/note-123/note.json' }, error: null };
      const mockUpsert = { data: { id: 'note-123' }, error: null };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue(mockUpload),
      } as any);
      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockResolvedValue(mockUpsert),
      } as any);

      await noteStorage.saveNote(noteWithoutAudio);

      expect(supabase.storage.from).toHaveBeenCalledWith('notes');
      expect(vi.mocked(supabase.storage.from).mock.results[0].value.copy).not.toHaveBeenCalled();
    });

    it('should handle upload errors', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUploadError = { data: null, error: new Error('Upload failed') };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue(mockUploadError),
      } as any);

      await expect(noteStorage.saveNote(mockNoteData)).rejects.toThrow('Upload failed');
    });
  });

  describe('getNote', () => {
    it('should retrieve a note by ID', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockNoteContent = {
        id: 'note-123',
        title: 'Test Note',
        transcription: 'Test transcription',
        summary: 'Test summary',
      };
      const mockDownload = {
        data: new Blob([JSON.stringify(mockNoteContent)]),
        error: null,
      };
      const mockPublicUrl = { data: { publicUrl: 'https://public-url.com/audio.mp3' } };
      const mockList = { data: [{ name: 'audio.mp3' }], error: null };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        download: vi.fn().mockResolvedValue(mockDownload),
        getPublicUrl: vi.fn().mockReturnValue(mockPublicUrl),
        list: vi.fn().mockResolvedValue(mockList),
      } as any);

      const result = await noteStorage.getNote('note-123');

      expect(result).toEqual({
        ...mockNoteContent,
        audioUrl: 'https://public-url.com/audio.mp3',
      });
      expect(supabase.storage.from).toHaveBeenCalledWith('notes');
    });

    it('should return null if note not found', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockDownloadError = {
        data: null,
        error: { message: 'Not found', status: 404 },
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        download: vi.fn().mockResolvedValue(mockDownloadError),
      } as any);

      const result = await noteStorage.getNote('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listNotes', () => {
    it('should list all notes for a user', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockNotes = [
        {
          id: 'note-1',
          title: 'Note 1',
          preview: 'Preview 1',
          created_at: '2023-01-01',
          folder_id: null,
        },
        {
          id: 'note-2',
          title: 'Note 2',
          preview: 'Preview 2',
          created_at: '2023-01-02',
          folder_id: 'folder-123',
        },
      ];
      const mockSelect = {
        data: mockNotes,
        error: null,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue(mockSelect),
          }),
        }),
      } as any);

      const result = await noteStorage.listNotes();

      expect(result).toEqual(mockNotes);
      expect(supabase.from).toHaveBeenCalledWith('note_metadata');
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

      await expect(noteStorage.listNotes()).rejects.toThrow('Database error');
    });
  });

  describe('deleteNote', () => {
    it('should delete note and all associated files', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockList = {
        data: [
          { name: 'note.json' },
          { name: 'audio.mp3' },
        ],
        error: null,
      };
      const mockRemove = { data: {}, error: null };
      const mockDelete = { data: {}, error: null };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        list: vi.fn().mockResolvedValue(mockList),
        remove: vi.fn().mockResolvedValue(mockRemove),
      } as any);
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockDelete),
        }),
      } as any);

      await noteStorage.deleteNote('note-123');

      expect(supabase.storage.from).toHaveBeenCalledWith('notes');
      const removeCall = vi.mocked(supabase.storage.from).mock.results[0].value.remove;
      expect(removeCall).toHaveBeenCalledWith([
        'note-123/note.json',
        'note-123/audio.mp3',
      ]);
      expect(supabase.from).toHaveBeenCalledWith('note_metadata');
    });

    it('should handle deletion errors', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockList = {
        data: [{ name: 'note.json' }],
        error: null,
      };
      const mockRemoveError = { data: null, error: new Error('Remove failed') };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        list: vi.fn().mockResolvedValue(mockList),
        remove: vi.fn().mockResolvedValue(mockRemoveError),
      } as any);

      await expect(noteStorage.deleteNote('note-123')).rejects.toThrow('Remove failed');
    });
  });

  describe('updateNoteTitle', () => {
    it('should update note title in metadata', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockUpdate = { data: {}, error: null };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockUpdate),
          }),
        }),
      } as any);

      await noteStorage.updateNoteTitle('note-123', 'New Title');

      expect(supabase.from).toHaveBeenCalledWith('note_metadata');
      const updateCall = vi.mocked(supabase.from).mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({
        title: 'New Title',
        updated_at: expect.any(String),
      });
    });
  });

  describe('updateNoteContent', () => {
    it('should update note content and preview', async () => {
      const mockAuth = {
        data: { user: { id: 'user-123' } },
        error: null,
      };
      const mockNoteContent = {
        id: 'note-123',
        title: 'Test Note',
        transcription: 'Old transcription',
        summary: 'Old summary',
      };
      const mockDownload = {
        data: new Blob([JSON.stringify(mockNoteContent)]),
        error: null,
      };
      const mockUpload = { data: {}, error: null };
      const mockUpdate = { data: {}, error: null };

      vi.mocked(supabase.auth.getUser).mockResolvedValue(mockAuth);
      vi.mocked(supabase.storage.from).mockReturnValue({
        download: vi.fn().mockResolvedValue(mockDownload),
        upload: vi.fn().mockResolvedValue(mockUpload),
      } as any);
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockUpdate),
          }),
        }),
      } as any);

      await noteStorage.updateNoteContent('note-123', 'New transcription content');

      const uploadCall = vi.mocked(supabase.storage.from).mock.results[0].value.upload;
      expect(uploadCall).toHaveBeenCalledWith(
        'note-123/note.json',
        expect.stringContaining('New transcription content'),
        { contentType: 'application/json', upsert: true }
      );
    });
  });
});