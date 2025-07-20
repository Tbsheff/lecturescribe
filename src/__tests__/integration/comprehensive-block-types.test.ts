import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signInTestUser, cleanupTestData, testSupabaseClient } from '@/test/supabase-test-client';

// Mock the Supabase client before importing services
vi.mock('@/integrations/supabase/client', () => ({
  supabase: testSupabaseClient,
}));

import * as blockService from '@/services/blockService';
import * as noteService from '@/services/noteService';

describe('Comprehensive Block Types Tests', () => {
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

  describe('All Block Types Creation and Validation', () => {
    it('should create and validate all text-based block types', async () => {
      const noteId = await noteService.createNote('Comprehensive Text Blocks Test');

      // Test text block with formatting
      const textBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 2,
        props: {
          text: 'This is a regular paragraph with various formatting options.',
          formatting: {
            bold: true,
            italic: false,
            highlight_color: '#ffff00',
            text_color: '#333333'
          }
        }
      });

      // Test heading blocks (1, 2, 3)
      const heading1Id = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-1',
        position: 3,
        props: {
          text: 'Major Section Heading',
          level: 1,
          collapsed: false
        }
      });

      const heading2Id = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-2',
        position: 4,
        props: {
          text: 'Subsection Heading',
          level: 2,
          collapsed: true
        }
      });

      const heading3Id = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-3',
        position: 5,
        props: {
          text: 'Sub-subsection Heading',
          level: 3
        }
      });

      // Test quote block
      const quoteBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'quote',
        position: 6,
        props: {
          text: 'The best way to predict the future is to invent it.',
          source: 'Alan Kay',
          author: 'Computer Scientist',
          citation: 'Standford University, 1971',
          timestamp: 45.2
        }
      });

      // Test key-point block
      const keyPointId = await blockService.createBlock({
        note_id: noteId,
        type: 'key-point',
        position: 7,
        props: {
          text: 'Machine learning requires large datasets for training.',
          importance: 'high',
          category: 'Data Requirements',
          source_reference: 'Lecture slide 15'
        }
      });

      // Verify all blocks were created correctly
      const blocks = await blockService.getBlocksForNote(noteId);
      expect(blocks).toHaveLength(7); // Title + 6 content blocks

      // Validate text block
      const textBlock = blocks.find(b => b.id === textBlockId);
      expect(textBlock?.type).toBe('text');
      expect(textBlock?.props.formatting?.bold).toBe(true);
      expect(textBlock?.props.formatting?.highlight_color).toBe('#ffff00');

      // Validate heading blocks
      const h1Block = blocks.find(b => b.id === heading1Id);
      expect(h1Block?.type).toBe('heading-1');
      expect(h1Block?.props.level).toBe(1);
      expect(h1Block?.props.collapsed).toBe(false);

      const h2Block = blocks.find(b => b.id === heading2Id);
      expect(h2Block?.props.collapsed).toBe(true);

      // Validate quote block
      const quoteBlock = blocks.find(b => b.id === quoteBlockId);
      expect(quoteBlock?.type).toBe('quote');
      expect(quoteBlock?.props.author).toBe('Computer Scientist');
      expect(quoteBlock?.props.timestamp).toBe(45.2);

      // Validate key-point block
      const keyPointBlock = blocks.find(b => b.id === keyPointId);
      expect(keyPointBlock?.type).toBe('key-point');
      expect(keyPointBlock?.props.importance).toBe('high');
      expect(keyPointBlock?.props.category).toBe('Data Requirements');
    });

    it('should create and validate AI-generated and transcription blocks', async () => {
      const noteId = await noteService.createNote('AI Content Blocks Test');

      // Test transcription block with full metadata
      const transcriptionId = await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        position: 2,
        props: {
          text: 'Today we will discuss the fundamentals of machine learning algorithms.',
          confidence: 0.96,
          speaker: 'Dr. Sarah Johnson',
          audio_start: 15.3,
          audio_end: 22.8,
          language: 'en-US',
          corrected: false,
          original_text: 'Today we will discuss the fundamentals of machine learning algorithms.'
        },
        audio_timestamp: 15.3,
        ai_generated: true
      });

      // Test summary block with source references
      const summaryId = await blockService.createBlock({
        note_id: noteId,
        type: 'summary',
        position: 3,
        props: {
          text: 'This lecture covers supervised and unsupervised learning, with emphasis on decision trees and neural networks.',
          summary_type: 'ai-generated',
          source_blocks: [transcriptionId],
          model_used: 'gpt-4',
          confidence: 0.92
        },
        ai_generated: true
      });

      // Test another transcription with correction
      const correctedTranscriptionId = await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        position: 4,
        props: {
          text: 'Neural networks are inspired by biological neural systems.',
          confidence: 0.88,
          speaker: 'Dr. Sarah Johnson',
          audio_start: 45.1,
          audio_end: 50.2,
          language: 'en-US',
          corrected: true,
          original_text: 'Neural networks are inspired by biological neuronal systems.'
        },
        audio_timestamp: 45.1,
        ai_generated: true
      });

      // Verify AI-generated blocks
      const blocks = await blockService.getBlocksForNote(noteId);
      const aiBlocks = blocks.filter(b => b.ai_generated);
      expect(aiBlocks).toHaveLength(3);

      // Validate transcription block
      const transcriptionBlock = blocks.find(b => b.id === transcriptionId);
      expect(transcriptionBlock?.type).toBe('transcription');
      expect(transcriptionBlock?.props.confidence).toBe(0.96);
      expect(transcriptionBlock?.props.speaker).toBe('Dr. Sarah Johnson');
      expect(transcriptionBlock?.props.corrected).toBe(false);

      // Validate summary block
      const summaryBlock = blocks.find(b => b.id === summaryId);
      expect(summaryBlock?.type).toBe('summary');
      expect(summaryBlock?.props.summary_type).toBe('ai-generated');
      expect(summaryBlock?.props.source_blocks).toContain(transcriptionId);
      expect(summaryBlock?.props.model_used).toBe('gpt-4');

      // Validate corrected transcription
      const correctedBlock = blocks.find(b => b.id === correctedTranscriptionId);
      expect(correctedBlock?.props.corrected).toBe(true);
      expect(correctedBlock?.props.original_text).toBe('Neural networks are inspired by biological neuronal systems.');
    });

    it('should create and validate media and interactive blocks', async () => {
      const noteId = await noteService.createNote('Media and Interactive Blocks Test');

      // Test audio-clip block
      const audioClipId = await blockService.createBlock({
        note_id: noteId,
        type: 'audio-clip',
        position: 2,
        props: {
          audio_url: 'https://example.com/lecture-segment.mp3',
          start_time: 120.5,
          end_time: 180.3,
          title: 'Introduction to Neural Networks',
          description: 'Professor explains the basic concepts of neural network architecture.',
          waveform_data: [0.1, 0.3, 0.8, 0.6, 0.4, 0.9, 0.2],
          playback_speed: 1.0
        },
        audio_timestamp: 120.5
      });

      // Test slide-image block
      const slideImageId = await blockService.createBlock({
        note_id: noteId,
        type: 'slide-image',
        position: 3,
        props: {
          image_url: 'https://example.com/slide-15.png',
          alt_text: 'Neural network architecture diagram',
          caption: 'Figure 1: Basic neural network with input, hidden, and output layers',
          slide_number: 15,
          extracted_text: 'Input Layer -> Hidden Layer -> Output Layer\nActivation Functions: ReLU, Sigmoid, Tanh',
          thumbnail_url: 'https://example.com/slide-15-thumb.png',
          width: 1920,
          height: 1080
        }
      });

      // Test code block
      const codeBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'code',
        position: 4,
        props: {
          code: `import numpy as np
from sklearn.neural_network import MLPClassifier

# Create a simple neural network
clf = MLPClassifier(hidden_layer_sizes=(100,), max_iter=1000)
clf.fit(X_train, y_train)
predictions = clf.predict(X_test)`,
          language: 'python',
          filename: 'neural_network_example.py',
          line_numbers: true,
          theme: 'dark',
          copy_button: true
        }
      });

      // Test table block
      const tableBlockId = await blockService.createBlock({
        note_id: noteId,
        type: 'table',
        position: 5,
        props: {
          headers: ['Algorithm', 'Type', 'Use Case', 'Accuracy'],
          rows: [
            ['Decision Tree', 'Supervised', 'Classification', '85%'],
            ['K-Means', 'Unsupervised', 'Clustering', 'N/A'],
            ['Neural Network', 'Supervised/Unsupervised', 'Various', '92%'],
            ['SVM', 'Supervised', 'Classification', '88%']
          ],
          caption: 'Comparison of machine learning algorithms',
          sortable: true,
          striped: true
        }
      });

      // Test divider block
      const dividerId = await blockService.createBlock({
        note_id: noteId,
        type: 'divider',
        position: 6,
        props: {
          style: 'line',
          thickness: 2,
          color: '#cccccc',
          margin: 16
        }
      });

      // Verify all media blocks
      const blocks = await blockService.getBlocksForNote(noteId);
      expect(blocks).toHaveLength(6); // Title + 5 media blocks

      // Validate audio-clip block
      const audioBlock = blocks.find(b => b.id === audioClipId);
      expect(audioBlock?.type).toBe('audio-clip');
      expect(audioBlock?.props.start_time).toBe(120.5);
      expect(audioBlock?.props.waveform_data).toHaveLength(7);

      // Validate slide-image block
      const slideBlock = blocks.find(b => b.id === slideImageId);
      expect(slideBlock?.type).toBe('slide-image');
      expect(slideBlock?.props.slide_number).toBe(15);
      expect(slideBlock?.props.width).toBe(1920);

      // Validate code block
      const codeBlock = blocks.find(b => b.id === codeBlockId);
      expect(codeBlock?.type).toBe('code');
      expect(codeBlock?.props.language).toBe('python');
      expect(codeBlock?.props.code).toContain('MLPClassifier');

      // Validate table block
      const tableBlock = blocks.find(b => b.id === tableBlockId);
      expect(tableBlock?.type).toBe('table');
      expect(tableBlock?.props.headers).toHaveLength(4);
      expect(tableBlock?.props.rows).toHaveLength(4);
      expect(tableBlock?.props.sortable).toBe(true);

      // Validate divider block
      const dividerBlock = blocks.find(b => b.id === dividerId);
      expect(dividerBlock?.type).toBe('divider');
      expect(dividerBlock?.props.style).toBe('line');
      expect(dividerBlock?.props.thickness).toBe(2);
    });

    it('should create and validate interactive and collaboration blocks', async () => {
      const noteId = await noteService.createNote('Interactive Blocks Test');

      // Test action-item block with full properties
      const actionItemId = await blockService.createBlock({
        note_id: noteId,
        type: 'action-item',
        position: 2,
        props: {
          text: 'Review chapter 7 on neural networks before next lecture',
          completed: false,
          due_date: '2024-01-25',
          priority: 'high',
          assigned_to: 'student@example.com',
          completion_date: undefined
        }
      });

      // Test completed action-item
      const completedActionId = await blockService.createBlock({
        note_id: noteId,
        type: 'action-item',
        position: 3,
        props: {
          text: 'Install Python scikit-learn library',
          completed: true,
          due_date: '2024-01-20',
          priority: 'medium',
          assigned_to: 'student@example.com',
          completion_date: '2024-01-19'
        }
      });

      // Test annotation block (comment)
      const commentId = await blockService.createBlock({
        note_id: noteId,
        type: 'annotation',
        position: 4,
        props: {
          text: 'This is a really important concept that will be on the exam.',
          annotation_type: 'comment',
          references: [actionItemId],
          resolved: false,
          thread_id: 'thread-001'
        }
      });

      // Test annotation block (question)
      const questionId = await blockService.createBlock({
        note_id: noteId,
        type: 'annotation',
        position: 5,
        props: {
          text: 'How does this relate to the backpropagation algorithm?',
          annotation_type: 'question',
          references: [],
          resolved: true,
          thread_id: 'thread-002'
        }
      });

      // Test annotation block (insight)
      const insightId = await blockService.createBlock({
        note_id: noteId,
        type: 'annotation',
        position: 6,
        props: {
          text: 'This connects to what we learned about optimization in calculus class.',
          annotation_type: 'insight',
          references: [questionId],
          resolved: false
        }
      });

      // Verify interactive blocks
      const blocks = await blockService.getBlocksForNote(noteId);
      expect(blocks).toHaveLength(6); // Title + 5 interactive blocks

      // Validate action-item blocks
      const actionBlock = blocks.find(b => b.id === actionItemId);
      expect(actionBlock?.type).toBe('action-item');
      expect(actionBlock?.props.completed).toBe(false);
      expect(actionBlock?.props.priority).toBe('high');
      expect(actionBlock?.props.due_date).toBe('2024-01-25');

      const completedBlock = blocks.find(b => b.id === completedActionId);
      expect(completedBlock?.props.completed).toBe(true);
      expect(completedBlock?.props.completion_date).toBe('2024-01-19');

      // Validate annotation blocks
      const commentBlock = blocks.find(b => b.id === commentId);
      expect(commentBlock?.type).toBe('annotation');
      expect(commentBlock?.props.annotation_type).toBe('comment');
      expect(commentBlock?.props.resolved).toBe(false);
      expect(commentBlock?.props.references).toContain(actionItemId);

      const questionBlock = blocks.find(b => b.id === questionId);
      expect(questionBlock?.props.annotation_type).toBe('question');
      expect(questionBlock?.props.resolved).toBe(true);

      const insightBlock = blocks.find(b => b.id === insightId);
      expect(insightBlock?.props.annotation_type).toBe('insight');
      expect(insightBlock?.props.references).toContain(questionId);
    });

    it('should create complex hierarchical structure with mixed block types', async () => {
      const noteId = await noteService.createNote('Complex Hierarchical Structure Test');

      // Create main section
      const mainSectionId = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-1',
        position: 2,
        props: { text: 'Machine Learning Fundamentals', level: 1 }
      });

      // Create subsection under main
      const subsectionId = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-2',
        parent_id: mainSectionId,
        position: 1,
        props: { text: 'Supervised Learning', level: 2 }
      });

      // Add transcription under subsection
      const transcriptionId = await blockService.createBlock({
        note_id: noteId,
        type: 'transcription',
        parent_id: subsectionId,
        position: 1,
        props: {
          text: 'Supervised learning uses labeled data to train models.',
          speaker: 'Professor',
          confidence: 0.94
        },
        ai_generated: true
      });

      // Add code example under subsection
      const codeId = await blockService.createBlock({
        note_id: noteId,
        type: 'code',
        parent_id: subsectionId,
        position: 2,
        props: {
          code: 'X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)',
          language: 'python'
        }
      });

      // Add action item under subsection
      const actionId = await blockService.createBlock({
        note_id: noteId,
        type: 'action-item',
        parent_id: subsectionId,
        position: 3,
        props: {
          text: 'Practice train_test_split with iris dataset',
          priority: 'medium'
        }
      });

      // Create another main section (sibling)
      const section2Id = await blockService.createBlock({
        note_id: noteId,
        type: 'heading-1',
        position: 3,
        props: { text: 'Unsupervised Learning', level: 1 }
      });

      // Add content under second section
      const summaryId = await blockService.createBlock({
        note_id: noteId,
        type: 'summary',
        parent_id: section2Id,
        position: 1,
        props: {
          text: 'Unsupervised learning finds patterns in data without labels.',
          summary_type: 'user-written'
        }
      });

      // Test tree structure
      const tree = await blockService.getBlockTree(noteId);
      expect(tree.length).toBeGreaterThan(0);

      // Verify hierarchical relationships
      const mainSection = tree.find(node => node.id === mainSectionId);
      expect(mainSection?.depth).toBe(0); // Root level

      const subsection = tree.find(node => node.id === subsectionId);
      expect(subsection?.depth).toBe(1); // Child of main section

      const transcription = tree.find(node => node.id === transcriptionId);
      expect(transcription?.depth).toBe(2); // Child of subsection

      // Verify all blocks were created
      const allBlocks = await blockService.getBlocksForNote(noteId);
      expect(allBlocks).toHaveLength(8); // Title + 7 content blocks

      // Verify mixed types under same parent
      const subsectionChildren = allBlocks.filter(b => b.parent_id === subsectionId);
      expect(subsectionChildren).toHaveLength(3);
      
      const childTypes = subsectionChildren.map(b => b.type);
      expect(childTypes).toContain('transcription');
      expect(childTypes).toContain('code');
      expect(childTypes).toContain('action-item');
    });

    it('should handle edge cases and special properties', async () => {
      const noteId = await noteService.createNote('Edge Cases Test');

      // Test block with minimal props
      const minimalId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 2,
        props: { text: 'Minimal text block' }
      });

      // Test block with all optional props
      const maximalId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 3,
        props: {
          text: 'Maximal text block with all properties',
          formatting: {
            bold: true,
            italic: true,
            underline: true,
            strikethrough: false,
            highlight_color: '#ffff00',
            text_color: '#000000',
            font_size: 'large'
          },
          tags: ['important', 'exam-material', 'fundamentals'],
          locked: false,
          collapsed: false,
          created_by: currentUser.id,
          edited_by: currentUser.id
        }
      });

      // Test empty text (should still work)
      const emptyTextId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 4,
        props: { text: '' }
      });

      // Test very long text
      const longText = 'A'.repeat(5000); // 5000 character string
      const longTextId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 5,
        props: { text: longText }
      });

      // Test special characters and unicode
      const unicodeId = await blockService.createBlock({
        note_id: noteId,
        type: 'text',
        position: 6,
        props: {
          text: 'Special chars: 🚀 α β γ δ ∑ ∫ ∂ ∇ "quotes" \'apostrophes\' & <html> {json: true}'
        }
      });

      // Verify all edge case blocks
      const blocks = await blockService.getBlocksForNote(noteId);
      expect(blocks).toHaveLength(6); // Title + 5 content blocks

      // Validate minimal block
      const minimalBlock = blocks.find(b => b.id === minimalId);
      expect(minimalBlock?.props.text).toBe('Minimal text block');
      expect(minimalBlock?.props.formatting).toBeUndefined();

      // Validate maximal block
      const maximalBlock = blocks.find(b => b.id === maximalId);
      expect(maximalBlock?.props.formatting?.bold).toBe(true);
      expect(maximalBlock?.props.tags).toHaveLength(3);
      expect(maximalBlock?.props.tags).toContain('important');

      // Validate empty text block
      const emptyBlock = blocks.find(b => b.id === emptyTextId);
      expect(emptyBlock?.props.text).toBe('');

      // Validate long text block
      const longBlock = blocks.find(b => b.id === longTextId);
      expect(longBlock?.props.text).toHaveLength(5000);

      // Validate unicode block
      const unicodeBlock = blocks.find(b => b.id === unicodeId);
      expect(unicodeBlock?.props.text).toContain('🚀');
      expect(unicodeBlock?.props.text).toContain('α β γ δ');
      expect(unicodeBlock?.props.text).toContain('<html>');
    });
  });
});