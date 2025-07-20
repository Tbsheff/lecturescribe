import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@/test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { supabase } from '@/integrations/supabase/client';
import { transcribeAudio, processAudioWithSummary } from '@/services/transcriptionService';
import { saveNote, getNote, updateNoteContent } from '@/services/noteStorage';
import { createFolder, moveFolder, buildFolderTree } from '@/services/folderService';
import NoteEditor from '@/components/notes/NoteEditor';
import EnhancedEditor from '@/components/editor/EnhancedEditor';

// Mock services and Supabase client
vi.mock('@/services/transcriptionService');
vi.mock('@/services/noteStorage');
vi.mock('@/services/folderService');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id' } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'mock-user-id' } } },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
        download: vi.fn().mockResolvedValue({ 
          data: new Blob(['{"title":"Test","content":"Test content"}'], { type: 'application/json' }), 
          error: null 
        }),
        getPublicUrl: vi.fn().mockReturnValue({ 
          data: { publicUrl: 'https://mock-url.com/file' } 
        }),
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { transcription: 'Mock transcription', summary: 'Mock summary' },
        error: null,
      }),
    },
  },
}));

describe('Service Integration with Components', () => {
  const mockUserId = 'mock-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Transcription Service with Audio Components', () => {
    it('should handle real-time transcription updates', async () => {
      const mockAudioFile = new File(['audio'], 'test.mp3', { type: 'audio/mp3' });
      let transcriptionCallback: ((progress: number) => void) | null = null;

      // Mock progressive transcription
      vi.mocked(transcribeAudio).mockImplementation(async (file) => {
        // Simulate progress updates
        for (let i = 0; i <= 100; i += 20) {
          await new Promise(resolve => setTimeout(resolve, 50));
          if (transcriptionCallback) transcriptionCallback(i);
        }
        return 'Complete transcription text';
      });

      const TestComponent = () => {
        const [progress, setProgress] = React.useState(0);
        const [transcription, setTranscription] = React.useState('');
        const [isProcessing, setIsProcessing] = React.useState(false);

        const handleTranscribe = async () => {
          setIsProcessing(true);
          transcriptionCallback = setProgress;
          try {
            const result = await transcribeAudio(mockAudioFile);
            setTranscription(result);
          } finally {
            setIsProcessing(false);
          }
        };

        return (
          <div>
            <button onClick={handleTranscribe}>Start Transcription</button>
            {isProcessing && <div>Processing: {progress}%</div>}
            {transcription && <div>Result: {transcription}</div>}
          </div>
        );
      };

      render(<TestComponent />);

      const button = screen.getByRole('button', { name: /start transcription/i });
      fireEvent.click(button);

      // Check progress updates
      await waitFor(() => {
        expect(screen.getByText(/Processing: \d+%/)).toBeInTheDocument();
      });

      // Check final result
      await waitFor(() => {
        expect(screen.getByText('Result: Complete transcription text')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should integrate audio processing with note creation workflow', async () => {
      const mockFile = new File(['audio'], 'lecture.mp3', { type: 'audio/mp3' });
      const mockNoteId = 'created-note-id';

      vi.mocked(processAudioWithSummary).mockResolvedValue({
        transcription: 'Lecture transcription',
        summary: 'Lecture summary',
        noteId: mockNoteId,
      });

      vi.mocked(saveNote).mockResolvedValue(mockNoteId);
      vi.mocked(getNote).mockResolvedValue({
        id: mockNoteId,
        title: 'Lecture Recording',
        transcription: 'Lecture transcription',
        summary: 'Lecture summary',
        audioUrl: 'https://mock-url.com/lecture.mp3',
      });

      const WorkflowComponent = () => {
        const [noteId, setNoteId] = React.useState<string | null>(null);
        const [note, setNote] = React.useState<any>(null);

        const handleProcess = async () => {
          const result = await processAudioWithSummary(
            mockFile,
            mockUserId,
            { title: 'Lecture Recording' }
          );
          setNoteId(result.noteId);
          
          // Fetch the created note
          const noteData = await getNote(result.noteId);
          setNote(noteData);
        };

        return (
          <div>
            <button onClick={handleProcess}>Process Audio</button>
            {noteId && <div>Note Created: {noteId}</div>}
            {note && (
              <div>
                <h3>{note.title}</h3>
                <p>{note.transcription}</p>
                <audio src={note.audioUrl} controls />
              </div>
            )}
          </div>
        );
      };

      render(<WorkflowComponent />);

      fireEvent.click(screen.getByRole('button', { name: /process audio/i }));

      await waitFor(() => {
        expect(screen.getByText(`Note Created: ${mockNoteId}`)).toBeInTheDocument();
        expect(screen.getByText('Lecture Recording')).toBeInTheDocument();
        expect(screen.getByText('Lecture transcription')).toBeInTheDocument();
        expect(screen.getByRole('audio')).toHaveAttribute('src', 'https://mock-url.com/lecture.mp3');
      });
    });
  });

  describe('Note Storage Service with Editor Components', () => {
    it('should auto-save note content with debouncing', async () => {
      const mockNoteId = 'autosave-note-id';
      const mockNote = {
        id: mockNoteId,
        title: 'Auto-save Test',
        transcription: 'Initial content',
        summary: 'Test summary',
      };

      vi.mocked(getNote).mockResolvedValue(mockNote);
      vi.mocked(updateNoteContent).mockResolvedValue(undefined);

      const AutoSaveEditor = () => {
        const [content, setContent] = React.useState('');
        const [saving, setSaving] = React.useState(false);
        const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

        React.useEffect(() => {
          getNote(mockNoteId).then(note => {
            setContent(note.transcription);
          });
        }, []);

        React.useEffect(() => {
          const timeoutId = setTimeout(async () => {
            if (content && content !== mockNote.transcription) {
              setSaving(true);
              await updateNoteContent(mockUserId, mockNoteId, content);
              setLastSaved(new Date());
              setSaving(false);
            }
          }, 500); // 500ms debounce

          return () => clearTimeout(timeoutId);
        }, [content]);

        return (
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Edit content..."
            />
            {saving && <div>Saving...</div>}
            {lastSaved && <div>Last saved: {lastSaved.toLocaleTimeString()}</div>}
          </div>
        );
      };

      render(<AutoSaveEditor />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Initial content')).toBeInTheDocument();
      });

      // Type new content
      const textarea = screen.getByPlaceholderText(/edit content/i);
      fireEvent.change(textarea, { target: { value: 'Updated content' } });

      // Should show saving indicator
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      // Should save and show last saved time
      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
        expect(screen.getByText(/Last saved:/)).toBeInTheDocument();
        expect(updateNoteContent).toHaveBeenCalledWith(
          mockUserId,
          mockNoteId,
          'Updated content'
        );
      });
    });

    it('should handle concurrent edits and conflict resolution', async () => {
      const mockNoteId = 'concurrent-note-id';
      let serverVersion = 1;
      let serverContent = 'Original content';

      vi.mocked(getNote).mockImplementation(async () => ({
        id: mockNoteId,
        title: 'Concurrent Edit Test',
        transcription: serverContent,
        summary: 'Test',
        version: serverVersion,
      }));

      vi.mocked(updateNoteContent).mockImplementation(async (userId, noteId, content) => {
        // Simulate version conflict
        if (serverVersion > 1) {
          throw new Error('Version conflict');
        }
        serverContent = content;
        serverVersion++;
      });

      const ConcurrentEditor = () => {
        const [content, setContent] = React.useState('');
        const [version, setVersion] = React.useState(0);
        const [conflict, setConflict] = React.useState(false);

        const loadNote = async () => {
          const note = await getNote(mockNoteId);
          setContent(note.transcription);
          setVersion(note.version);
          setConflict(false);
        };

        React.useEffect(() => {
          loadNote();
        }, []);

        const handleSave = async () => {
          try {
            await updateNoteContent(mockUserId, mockNoteId, content);
            setVersion(v => v + 1);
          } catch (error) {
            if (error.message === 'Version conflict') {
              setConflict(true);
            }
          }
        };

        const resolveConflict = async () => {
          await loadNote();
        };

        return (
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <button onClick={handleSave}>Save</button>
            <div>Version: {version}</div>
            {conflict && (
              <div>
                <p>Conflict detected!</p>
                <button onClick={resolveConflict}>Reload Latest</button>
              </div>
            )}
          </div>
        );
      };

      render(<ConcurrentEditor />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Original content')).toBeInTheDocument();
        expect(screen.getByText('Version: 1')).toBeInTheDocument();
      });

      // First edit succeeds
      fireEvent.change(screen.getByRole('textbox'), { 
        target: { value: 'First edit' } 
      });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText('Version: 2')).toBeInTheDocument();
      });

      // Simulate another user's edit
      serverVersion = 3;
      serverContent = 'Another user edit';

      // This edit should conflict
      fireEvent.change(screen.getByRole('textbox'), { 
        target: { value: 'Second edit' } 
      });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText('Conflict detected!')).toBeInTheDocument();
      });

      // Resolve conflict
      fireEvent.click(screen.getByRole('button', { name: /reload latest/i }));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Another user edit')).toBeInTheDocument();
        expect(screen.getByText('Version: 3')).toBeInTheDocument();
      });
    });
  });

  describe('Folder Service with Tree Components', () => {
    it('should handle drag-and-drop folder reorganization', async () => {
      const mockFolders = [
        { id: 'folder-1', name: 'Root 1', parent_id: null },
        { id: 'folder-2', name: 'Root 2', parent_id: null },
        { id: 'folder-3', name: 'Child', parent_id: 'folder-1' },
      ];

      vi.mocked(buildFolderTree).mockResolvedValue([
        {
          id: 'folder-1',
          name: 'Root 1',
          type: 'folder',
          children: [
            {
              id: 'folder-3',
              name: 'Child',
              type: 'folder',
              children: [],
              parentId: 'folder-1',
            },
          ],
          parentId: null,
        },
        {
          id: 'folder-2',
          name: 'Root 2',
          type: 'folder',
          children: [],
          parentId: null,
        },
      ]);

      vi.mocked(moveFolder).mockResolvedValue(undefined);

      const DraggableFolderTree = () => {
        const [tree, setTree] = React.useState<any[]>([]);
        const [draggedItem, setDraggedItem] = React.useState<string | null>(null);

        React.useEffect(() => {
          buildFolderTree(mockUserId).then(setTree);
        }, []);

        const handleDragStart = (folderId: string) => {
          setDraggedItem(folderId);
        };

        const handleDrop = async (targetFolderId: string) => {
          if (draggedItem && draggedItem !== targetFolderId) {
            await moveFolder(mockUserId, draggedItem, targetFolderId);
            // Refresh tree
            const newTree = await buildFolderTree(mockUserId);
            setTree(newTree);
          }
          setDraggedItem(null);
        };

        const renderFolder = (folder: any) => (
          <div
            key={folder.id}
            draggable
            onDragStart={() => handleDragStart(folder.id)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(folder.id);
            }}
            onDragOver={(e) => e.preventDefault()}
            style={{ marginLeft: folder.parentId ? '20px' : '0' }}
          >
            <span>{folder.name}</span>
            {folder.children?.map(renderFolder)}
          </div>
        );

        return (
          <div>
            {tree.map(renderFolder)}
            {draggedItem && <div>Dragging: {draggedItem}</div>}
          </div>
        );
      };

      render(<DraggableFolderTree />);

      await waitFor(() => {
        expect(screen.getByText('Root 1')).toBeInTheDocument();
        expect(screen.getByText('Root 2')).toBeInTheDocument();
        expect(screen.getByText('Child')).toBeInTheDocument();
      });

      // Simulate drag and drop
      const childFolder = screen.getByText('Child');
      const root2Folder = screen.getByText('Root 2');

      fireEvent.dragStart(childFolder);
      expect(screen.getByText('Dragging: folder-3')).toBeInTheDocument();

      fireEvent.drop(root2Folder);

      await waitFor(() => {
        expect(moveFolder).toHaveBeenCalledWith(
          mockUserId,
          'folder-3',
          'folder-2'
        );
      });
    });

    it('should handle batch operations on folders and notes', async () => {
      const mockOperations = [
        { type: 'move', noteId: 'note-1', targetFolderId: 'folder-1' },
        { type: 'move', noteId: 'note-2', targetFolderId: 'folder-1' },
        { type: 'move', noteId: 'note-3', targetFolderId: 'folder-2' },
      ];

      const BatchOperationComponent = () => {
        const [selectedNotes, setSelectedNotes] = React.useState<string[]>([]);
        const [processing, setProcessing] = React.useState(false);
        const [progress, setProgress] = React.useState(0);

        const moveNote = async (userId: string, noteId: string, folderId: string) => {
          // Mock function for moving notes
          return Promise.resolve();
        };

        const handleBatchMove = async (targetFolderId: string) => {
          setProcessing(true);
          setProgress(0);

          for (let i = 0; i < selectedNotes.length; i++) {
            await moveNote(mockUserId, selectedNotes[i], targetFolderId);
            setProgress(((i + 1) / selectedNotes.length) * 100);
          }

          setProcessing(false);
          setSelectedNotes([]);
        };

        return (
          <div>
            <div>
              {['note-1', 'note-2', 'note-3'].map(noteId => (
                <label key={noteId}>
                  <input
                    type="checkbox"
                    checked={selectedNotes.includes(noteId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedNotes([...selectedNotes, noteId]);
                      } else {
                        setSelectedNotes(selectedNotes.filter(id => id !== noteId));
                      }
                    }}
                  />
                  {noteId}
                </label>
              ))}
            </div>
            <button
              onClick={() => handleBatchMove('folder-1')}
              disabled={selectedNotes.length === 0 || processing}
            >
              Move to Folder 1
            </button>
            {processing && <div>Progress: {progress.toFixed(0)}%</div>}
          </div>
        );
      };

      render(<BatchOperationComponent />);

      // Select multiple notes
      fireEvent.click(screen.getByLabelText('note-1'));
      fireEvent.click(screen.getByLabelText('note-2'));

      // Move them
      fireEvent.click(screen.getByRole('button', { name: /move to folder 1/i }));

      await waitFor(() => {
        expect(screen.getByText(/Progress: \d+%/)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(moveNote).toHaveBeenCalledTimes(2);
        expect(moveNote).toHaveBeenCalledWith(mockUserId, 'note-1', 'folder-1');
        expect(moveNote).toHaveBeenCalledWith(mockUserId, 'note-2', 'folder-1');
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service failures with retry logic', async () => {
      let attemptCount = 0;
      
      vi.mocked(saveNote).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return 'success-note-id';
      });

      const RetryComponent = () => {
        const [status, setStatus] = React.useState('');
        const [retryCount, setRetryCount] = React.useState(0);

        const saveWithRetry = async () => {
          const maxRetries = 3;
          let lastError;

          for (let i = 0; i < maxRetries; i++) {
            try {
              setStatus(`Attempting save... (${i + 1}/${maxRetries})`);
              setRetryCount(i);
              const result = await saveNote(mockUserId, {
                title: 'Test',
                transcription: 'Content',
                summary: 'Summary',
              });
              setStatus('Success!');
              return result;
            } catch (error) {
              lastError = error;
              if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
              }
            }
          }
          
          setStatus(`Failed after ${maxRetries} attempts`);
          throw lastError;
        };

        return (
          <div>
            <button onClick={saveWithRetry}>Save with Retry</button>
            <div>{status}</div>
            <div>Retry count: {retryCount}</div>
          </div>
        );
      };

      render(<RetryComponent />);

      fireEvent.click(screen.getByRole('button', { name: /save with retry/i }));

      // Should show retry attempts
      await waitFor(() => {
        expect(screen.getByText(/Attempting save/)).toBeInTheDocument();
      });

      // Should eventually succeed
      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument();
        expect(attemptCount).toBe(3);
      }, { timeout: 5000 });
    });

    it('should handle offline mode with queue system', async () => {
      const OfflineQueueComponent = () => {
        const [isOnline, setIsOnline] = React.useState(true);
        const [queue, setQueue] = React.useState<any[]>([]);
        const [syncStatus, setSyncStatus] = React.useState('');

        const addToQueue = (operation: any) => {
          setQueue(prev => [...prev, { ...operation, id: Date.now() }]);
        };

        const processQueue = async () => {
          if (!isOnline || queue.length === 0) return;

          setSyncStatus('Syncing...');
          const processed = [];

          for (const operation of queue) {
            try {
              if (operation.type === 'saveNote') {
                await saveNote(mockUserId, operation.data);
              } else if (operation.type === 'updateNote') {
                await updateNoteContent(mockUserId, operation.noteId, operation.content);
              }
              processed.push(operation.id);
            } catch (error) {
              console.error('Queue processing error:', error);
              break;
            }
          }

          setQueue(prev => prev.filter(op => !processed.includes(op.id)));
          setSyncStatus(`Synced ${processed.length} operations`);
        };

        React.useEffect(() => {
          if (isOnline) {
            processQueue();
          }
        }, [isOnline]);

        const handleSaveNote = () => {
          const operation = {
            type: 'saveNote',
            data: {
              title: 'Offline Note',
              transcription: 'Created while offline',
              summary: 'Offline summary',
            },
          };

          if (isOnline) {
            saveNote(mockUserId, operation.data);
          } else {
            addToQueue(operation);
          }
        };

        return (
          <div>
            <label>
              <input
                type="checkbox"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
              />
              Online
            </label>
            <button onClick={handleSaveNote}>Save Note</button>
            <div>Queue size: {queue.length}</div>
            <div>{syncStatus}</div>
          </div>
        );
      };

      vi.mocked(saveNote).mockResolvedValue('offline-note-id');

      render(<OfflineQueueComponent />);

      // Go offline
      fireEvent.click(screen.getByLabelText('Online'));
      expect(screen.getByLabelText('Online')).not.toBeChecked();

      // Save notes while offline
      fireEvent.click(screen.getByRole('button', { name: /save note/i }));
      fireEvent.click(screen.getByRole('button', { name: /save note/i }));

      await waitFor(() => {
        expect(screen.getByText('Queue size: 2')).toBeInTheDocument();
      });

      // Go back online
      fireEvent.click(screen.getByLabelText('Online'));

      // Should process queue
      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Synced 2 operations')).toBeInTheDocument();
        expect(screen.getByText('Queue size: 0')).toBeInTheDocument();
        expect(saveNote).toHaveBeenCalledTimes(2);
      });
    });
  });
});