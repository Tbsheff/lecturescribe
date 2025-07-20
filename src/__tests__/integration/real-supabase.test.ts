import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signInTestUser, TEST_USER_EMAIL, cleanupTestData, testSupabaseClient } from '@/test/supabase-test-client';

// Mock the Supabase client before importing services
vi.mock('@/integrations/supabase/client', () => ({
  supabase: testSupabaseClient,
}));

import * as folderService from '@/services/folderService';
import * as noteStorage from '@/services/noteStorage';

// This test file uses the real local Supabase instance
describe('Real Supabase Integration Tests', () => {
  let currentUser: any = null;

  beforeEach(async () => {
    await cleanupTestData();
    
    // Try to sign in, if it fails, create the user first
    try {
      currentUser = await signInTestUser();
    } catch (error) {
      // User might not exist, try to create and then sign in
      try {
        const { createTestUser } = await import('@/test/supabase-test-client');
        await createTestUser();
        currentUser = await signInTestUser();
      } catch (createError) {
        console.error('Failed to create or sign in test user:', createError);
        throw createError;
      }
    }
  });

  describe('Folder Service', () => {
    it('should create and retrieve folders', async () => {
      // Create a folder using service
      const createdFolderId = await folderService.createFolder(currentUser.id, 'Test Folder', null);
      expect(createdFolderId).toBeDefined();

      // Get all folders
      const folders = await folderService.getFolders(currentUser.id);
      expect(folders).toHaveLength(1);
      expect(folders[0].name).toBe('Test Folder');
      expect(folders[0].id).toBe(createdFolderId);
    });

    it('should create nested folders', async () => {
      // Create parent folder
      const parentFolderId = await folderService.createFolder(currentUser.id, 'Parent Folder', null);
      
      // Create child folder
      const childFolderId = await folderService.createFolder(currentUser.id, 'Child Folder', parentFolderId);

      // Build folder tree
      const tree = await folderService.buildFolderTree(currentUser.id);
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Parent Folder');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('Child Folder');
    });

    it('should update folder names', async () => {
      const folderId = await folderService.createFolder(currentUser.id, 'Original Name', null);
      
      await folderService.updateFolder(currentUser.id, folderId, 'Updated Name');
      
      const folders = await folderService.getFolders(currentUser.id);
      expect(folders[0].name).toBe('Updated Name');
    });

    it('should delete folders', async () => {
      const folderId = await folderService.createFolder(currentUser.id, 'To Delete', null);
      
      await folderService.deleteFolder(currentUser.id, folderId);
      
      const folders = await folderService.getFolders(currentUser.id);
      expect(folders).toHaveLength(0);
    });
  });

  describe('Note Storage Service', () => {
    it('should create and retrieve notes', async () => {
      // Create a note
      const noteId = await noteStorage.createEmptyNote(currentUser.id, 'Test Note');
      expect(noteId).toBeDefined();

      // Retrieve the note
      const note = await noteStorage.getNote(noteId);
      expect(note).toBeDefined();
      expect(note?.title).toBe('Test Note');
      expect(note?.user_id).toBeDefined();
    });

    it('should save note with content', async () => {
      const noteData = {
        title: 'Rich Note',
        transcription: 'This is the transcription content',
        summary: 'This is the summary',
        audioUrl: 'https://example.com/audio.mp3',
      };

      const noteId = await noteStorage.saveNote(currentUser.id, noteData);
      expect(noteId).toBeDefined();

      const retrievedNote = await noteStorage.getNote(noteId);
      expect(retrievedNote?.title).toBe('Rich Note');
      expect(retrievedNote?.transcription).toBe('This is the transcription content');
      expect(retrievedNote?.summary).toBe('This is the summary');
    });

    it('should update note content', async () => {
      const noteId = await noteStorage.createEmptyNote(currentUser.id, 'Note to Update');
      
      await noteStorage.updateNoteContent(currentUser.id, noteId, 'Updated content');
      
      const note = await noteStorage.getNote(noteId);
      expect(note?.transcription).toBe('Updated content');
    });

    it('should update note title', async () => {
      const noteId = await noteStorage.createEmptyNote(currentUser.id, 'Original Title');
      
      await noteStorage.updateNoteTitle(currentUser.id, noteId, 'New Title');
      
      const note = await noteStorage.getNote(noteId);
      expect(note?.title).toBe('New Title');
    });

    it('should delete notes', async () => {
      const noteId = await noteStorage.createEmptyNote(currentUser.id, 'Note to Delete');
      
      await noteStorage.deleteNote(currentUser.id, noteId);
      
      const note = await noteStorage.getNote(noteId);
      expect(note).toBeNull();
    });

    it('should list user notes', async () => {
      // Create multiple notes
      await noteStorage.createEmptyNote(currentUser.id, 'Note 1');
      await noteStorage.createEmptyNote(currentUser.id, 'Note 2');
      await noteStorage.createEmptyNote(currentUser.id, 'Note 3');

      const notes = await noteStorage.listNotes(currentUser.id);
      expect(notes).toHaveLength(3);
      expect(notes.map(n => n.title)).toContain('Note 1');
      expect(notes.map(n => n.title)).toContain('Note 2');
      expect(notes.map(n => n.title)).toContain('Note 3');
    });
  });

  describe('Notes and Folders Integration', () => {
    it('should create notes in folders', async () => {
      // Create a folder
      const folderId = await folderService.createFolder(currentUser.id, 'Notes Folder', null);
      
      // Create a note in the folder
      const noteId = await noteStorage.createEmptyNote(currentUser.id, 'Folder Note', folderId);
      
      // Verify note is in folder
      const note = await noteStorage.getNote(noteId);
      expect(note?.folderId).toBe(folderId);
      
      // Build folder tree and verify note appears
      const tree = await folderService.buildFolderTree(currentUser.id);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].type).toBe('note');
      expect(tree[0].children[0].name).toBe('Folder Note');
    });

    it('should move notes between folders', async () => {
      const folder1Id = await folderService.createFolder(currentUser.id, 'Folder 1', null);
      const folder2Id = await folderService.createFolder(currentUser.id, 'Folder 2', null);
      
      const noteId = await noteStorage.createEmptyNote(currentUser.id, 'Moveable Note', folder1Id);
      
      // Move note to folder 2
      await folderService.moveNote(currentUser.id, noteId, folder2Id);
      
      const note = await noteStorage.getNote(noteId);
      expect(note?.folderId).toBe(folder2Id);
    });
  });
});