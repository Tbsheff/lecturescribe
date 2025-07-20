import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signInTestUser, cleanupTestData, testSupabaseClient } from '@/test/supabase-test-client';

// Mock the Supabase client before importing services
vi.mock('@/integrations/supabase/client', () => ({
  supabase: testSupabaseClient,
}));

import * as blockService from '@/services/blockService';
import * as noteService from '@/services/noteService';

describe('Block System Integration Tests', () => {
  let currentUser: any = null;

  beforeEach(async () => {
    await cleanupTestData();
    
    try {
      currentUser = await signInTestUser();
    } catch (error) {
      const { createTestUser } = await import('@/test/supabase-test-client');
      await createTestUser();
      currentUser = await signInTestUser();
    }
  });

  describe('Note Creation and Block Management', () => {
    it('should create a note with initial title block', async () => {
      // Create a new note
      const noteId = await noteService.createNote('Test Lecture Note');
      expect(noteId).toBeDefined();

      // Verify note was created
      const note = await noteService.getNote(noteId);
      expect(note).toBeDefined();
      expect(note?.title).toBe('Test Lecture Note');

      // Verify title block was created
      const blocks = await blockService.getBlocksForNote(noteId);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('heading-1');
      expect(blocks[0].props.text).toBe('Test Lecture Note');
    });

    it('should add different types of blocks to a note', async () => {
      // Create a note
      const noteId = await noteService.createNote('Lecture with Multiple Blocks');

      // Add a transcription block
      const transcriptionBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        position: 2,
        props: {
          text: 'This is a transcribed segment from the lecture.',
          confidence: 0.95,
          speaker: 'Professor Smith',
          audio_start: 10.5,
          audio_end: 25.3
        },
        audio_timestamp: 10.5,
        ai_generated: true
      });

      // Add a summary block
      const summaryBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'summary',
        position: 3,
        props: {
          text: 'Key points from this lecture segment.',
          summary_type: 'ai-generated',
          source_blocks: [transcriptionBlockId]
        },
        ai_generated: true
      });

      // Add an action item
      const actionBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'action-item',
        position: 4,
        props: {
          text: 'Review chapter 5 before next class',
          completed: false,
          priority: 'medium'
        }
      });

      // Verify all blocks were created
      const blocks = await blockService.getBlocksForNote(noteId);
      expect(blocks).toHaveLength(4); // Title + 3 content blocks

      // Verify block types and content
      const transcriptionBlock = blocks.find(b => b.id === transcriptionBlockId);
      expect(transcriptionBlock?.type).toBe('transcription');
      expect(transcriptionBlock?.ai_generated).toBe(true);
      expect(transcriptionBlock?.audio_timestamp).toBe(10.5);

      const summaryBlock = blocks.find(b => b.id === summaryBlockId);
      expect(summaryBlock?.type).toBe('summary');
      expect(summaryBlock?.props.summary_type).toBe('ai-generated');

      const actionBlock = blocks.find(b => b.id === actionBlockId);
      expect(actionBlock?.type).toBe('action-item');
      expect(actionBlock?.props.priority).toBe('medium');
    });

    it('should handle hierarchical block structure', async () => {
      const noteId = await noteService.createNote('Hierarchical Content');

      // Add a main section
      const sectionBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-2',
        position: 2,
        props: {
          text: 'Introduction to Machine Learning',
          level: 2
        }
      });

      // Add a subsection under the main section
      const subsectionBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-3',
        parent_id: sectionBlockId,
        position: 1,
        props: {
          text: 'Supervised Learning',
          level: 3
        }
      });

      // Add content under the subsection
      const contentBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        parent_id: subsectionBlockId,
        position: 1,
        props: {
          text: 'Supervised learning uses labeled training data to learn a mapping from inputs to outputs.'
        }
      });

      // Test tree structure
      const treeNodes = await blockService.getBlockTree(noteId);
      expect(treeNodes.length).toBeGreaterThan(0);

      // Find the section in tree
      const sectionNode = treeNodes.find(node => node.id === sectionBlockId);
      expect(sectionNode).toBeDefined();
      expect(sectionNode?.depth).toBe(0); // Root level
    });

    it('should search blocks by content', async () => {
      const noteId = await noteService.createNote('Searchable Content');

      // Add blocks with specific content
      await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 2,
        props: {
          text: 'Machine learning algorithms can be supervised or unsupervised.'
        }
      });

      await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        position: 3,
        props: {
          text: 'Deep learning is a subset of machine learning using neural networks.'
        }
      });

      // Search for content in this specific note
      const searchResults = await blockService.searchBlocks('machine learning', currentUser.id, noteId);
      expect(searchResults).toHaveLength(2);
      
      // Verify search results contain relevant content
      const texts = searchResults.map(result => result.block.props.text);
      expect(texts.some(text => text?.includes('algorithms'))).toBe(true);
      expect(texts.some(text => text?.includes('neural networks'))).toBe(true);
    });

    it('should get blocks by audio timestamp range', async () => {
      const noteId = await noteService.createNote('Audio-Linked Content');

      // Add blocks with different timestamps
      const block1Id = await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        position: 2,
        props: { text: 'Introduction at start of lecture' },
        audio_timestamp: 5.0
      });

      const block2Id = await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        position: 3,
        props: { text: 'Main content in middle' },
        audio_timestamp: 120.0
      });

      const block3Id = await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        position: 4,
        props: { text: 'Conclusion at end' },
        audio_timestamp: 300.0
      });

      // Get blocks in specific time range
      const timeRangeBlocks = await blockService.getBlocksByTimeRange(noteId, 100.0, 200.0);
      expect(timeRangeBlocks).toHaveLength(1);
      expect(timeRangeBlocks[0].id).toBe(block2Id);
      expect(timeRangeBlocks[0].props.text).toBe('Main content in middle');
    });

    it('should update and delete blocks', async () => {
      const noteId = await noteService.createNote('Updatable Content');

      // Create a block
      const blockId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 2,
        props: {
          text: 'Original content'
        }
      });

      // Update the block
      await blockService.updateBlock(blockId, {
        props: {
          text: 'Updated content',
          formatting: { bold: true }
        }
      });

      // Verify update
      const updatedBlock = await blockService.getBlock(blockId);
      expect(updatedBlock?.props.text).toBe('Updated content');
      expect(updatedBlock?.props.formatting?.bold).toBe(true);

      // Delete the block
      await blockService.deleteBlock(blockId);

      // Verify deletion
      const deletedBlock = await blockService.getBlock(blockId);
      expect(deletedBlock).toBeNull();
    });

    it('should maintain note metadata correctly', async () => {
      const noteId = await noteService.createNote('Metadata Test');

      // Add several blocks
      await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 2,
        props: { text: 'First block' }
      });

      await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 3,
        props: { text: 'Second block' }
      });

      // Check note metadata
      const note = await noteService.getNote(noteId);
      expect(note?.block_count).toBe(3); // Title + 2 content blocks

      // Get note with extended metadata
      const notes = await noteService.getNotes(currentUser.id);
      const noteWithMeta = notes.find(n => n.id === noteId);
      expect(noteWithMeta?.block_count_calc).toBe(3);
      expect(noteWithMeta?.preview).toContain('Metadata Test'); // Title should be in preview
    });
  });
});