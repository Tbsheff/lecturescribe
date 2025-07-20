import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import AudioUploader from '@/components/audio/AudioUploader';
import { processAudioWithSummary } from '@/services/transcriptionService';
import { saveNote } from '@/services/noteStorage';

// Mock the services
vi.mock('@/services/transcriptionService');
vi.mock('@/services/noteStorage');

describe('Audio Upload → Transcription → Note Creation Integration', () => {
  const mockUserId = 'mock-user-id';
  const mockFile = new File(['audio content'], 'test-audio.mp3', { type: 'audio/mp3' });
  const mockOnUploadComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnUploadComplete.mockClear();
  });

  it('should complete the full flow from audio upload to note creation', async () => {
    // Mock successful audio processing
    const mockTranscription = 'This is the transcribed audio content';
    const mockSummary = '## Summary\n\nThis audio discusses important topics';
    const mockNoteId = 'created-note-id';

    vi.mocked(processAudioWithSummary).mockResolvedValue({
      transcription: mockTranscription,
      summary: mockSummary,
      noteId: mockNoteId,
    });

    vi.mocked(saveNote).mockResolvedValue(mockNoteId);

    // Override MSW handler for storage upload
    server.use(
      http.post('*/storage/v1/object/audio_uploads/*', () => {
        return HttpResponse.json({
          Key: 'audio_uploads/temp_audio/test-audio.mp3',
        });
      }),
      http.get('*/storage/v1/object/audio_uploads/*', () => {
        return HttpResponse.blob(new Blob(['audio data'], { type: 'audio/mp3' }));
      })
    );

    // Render the audio uploader
    render(<AudioUploader onUploadComplete={mockOnUploadComplete} />);

    // Find and interact with file input
    const fileInput = screen.getByLabelText(/choose file/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for file to be processed
    await waitFor(() => {
      expect(screen.getByText('test-audio.mp3')).toBeInTheDocument();
    });

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /upload and transcribe/i });
    fireEvent.click(uploadButton);

    // Wait for the upload process to complete
    await waitFor(() => {
      expect(processAudioWithSummary).toHaveBeenCalledWith(
        mockFile,
        mockUserId,
        expect.objectContaining({
          title: expect.stringContaining('Audio Recording'),
        })
      );
    });

    // Verify the complete flow
    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith({
        noteId: mockNoteId,
        transcription: mockTranscription,
        summary: mockSummary,
      });
    });

    // Check success message
    expect(screen.getByText(/audio uploaded and transcribed successfully/i)).toBeInTheDocument();
  });

  it('should handle errors during audio processing', async () => {
    // Mock failed audio processing
    const errorMessage = 'Failed to process audio';
    vi.mocked(processAudioWithSummary).mockRejectedValue(new Error(errorMessage));

    render(<AudioUploader onUploadComplete={mockOnUploadComplete} />);

    // Upload a file
    const fileInput = screen.getByLabelText(/choose file/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('test-audio.mp3')).toBeInTheDocument();
    });

    // Try to upload
    const uploadButton = screen.getByRole('button', { name: /upload and transcribe/i });
    fireEvent.click(uploadButton);

    // Wait for error handling
    await waitFor(() => {
      expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
    });

    // Verify that onUploadComplete was not called
    expect(mockOnUploadComplete).not.toHaveBeenCalled();
  });

  it('should handle large audio files with progress tracking', async () => {
    const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large-audio.mp3', { 
      type: 'audio/mp3' 
    });

    vi.mocked(processAudioWithSummary).mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            transcription: 'Large file transcription',
            summary: 'Large file summary',
            noteId: 'large-note-id',
          });
        }, 1000);
      });
    });

    render(<AudioUploader onUploadComplete={mockOnUploadComplete} />);

    // Upload large file
    const fileInput = screen.getByLabelText(/choose file/i);
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('large-audio.mp3')).toBeInTheDocument();
    });

    const uploadButton = screen.getByRole('button', { name: /upload and transcribe/i });
    fireEvent.click(uploadButton);

    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    // Wait for completion
    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('should validate file types before upload', async () => {
    const invalidFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });

    render(<AudioUploader onUploadComplete={mockOnUploadComplete} />);

    const fileInput = screen.getByLabelText(/choose file/i);
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    // Should show error for invalid file type
    await waitFor(() => {
      expect(screen.getByText(/please select a valid audio file/i)).toBeInTheDocument();
    });

    // Upload button should be disabled
    const uploadButton = screen.getByRole('button', { name: /upload and transcribe/i });
    expect(uploadButton).toBeDisabled();
  });

  it('should integrate with note metadata creation', async () => {
    const mockMetadata = {
      title: 'Meeting Recording - ' + new Date().toLocaleDateString(),
      folder_id: 'target-folder-id',
    };

    vi.mocked(processAudioWithSummary).mockResolvedValue({
      transcription: 'Meeting transcription',
      summary: 'Meeting summary',
      noteId: 'meeting-note-id',
    });

    // Mock note metadata creation
    server.use(
      http.post('*/rest/v1/note_metadata', async ({ request }) => {
        const body = await request.json() as any;
        expect(body).toMatchObject({
          title: mockMetadata.title,
          folder_id: mockMetadata.folder_id,
          user_id: mockUserId,
        });
        return HttpResponse.json({
          ...body,
          id: 'meeting-note-id',
          created_at: new Date().toISOString(),
        });
      })
    );

    render(<AudioUploader 
      onUploadComplete={mockOnUploadComplete} 
      metadata={mockMetadata}
    />);

    const fileInput = screen.getByLabelText(/choose file/i);
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText('test-audio.mp3')).toBeInTheDocument();
    });

    const uploadButton = screen.getByRole('button', { name: /upload and transcribe/i });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(processAudioWithSummary).toHaveBeenCalledWith(
        mockFile,
        mockUserId,
        expect.objectContaining(mockMetadata)
      );
    });
  });
});