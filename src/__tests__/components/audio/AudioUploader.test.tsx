import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { AudioUploader } from '@/components/audio/AudioUploader';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { processAudioWithSummary } from '@/services/transcription';

// Mock dependencies
vi.mock('@/hooks/useAuth');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));
vi.mock('@/services/transcription', () => ({
  processAudioWithSummary: vi.fn(),
}));

describe.skip('AudioUploader Component', () => {
  const mockNavigate = vi.fn();
  const mockOnAudioUploaded = vi.fn();
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: { user: mockUser },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    } as any);
  });

  const renderAudioUploader = () => {
    return render(<AudioUploader onAudioUploaded={mockOnAudioUploaded} />);
  };

  it('should render upload interface', () => {
    renderAudioUploader();
    
    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your audio file here/)).toBeInTheDocument();
    expect(screen.getByText(/Supports MP3, WAV, M4A, MP4, WebM/)).toBeInTheDocument();
  });

  it('should handle file selection via browse button', async () => {
    const user = userEvent.setup();
    renderAudioUploader();
    
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, file);
    
    expect(screen.getByText('test.mp3')).toBeInTheDocument();
    expect(screen.getByText(/Audio\/MP3/i)).toBeInTheDocument();
  });

  it('should validate file type', async () => {
    const user = userEvent.setup();
    renderAudioUploader();
    
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, invalidFile);
    
    expect(toast.error).toHaveBeenCalledWith(
      'Please upload a valid audio file (MP3, WAV, M4A, MP4, or WebM)'
    );
    expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
  });

  it('should validate file size', async () => {
    const user = userEvent.setup();
    renderAudioUploader();
    
    // Create a file larger than 100MB
    const largeFile = new File([new ArrayBuffer(101 * 1024 * 1024)], 'large.mp3', { 
      type: 'audio/mp3' 
    });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, largeFile);
    
    expect(toast.error).toHaveBeenCalledWith('File size must be less than 100MB');
    expect(screen.queryByText('large.mp3')).not.toBeInTheDocument();
  });

  it('should handle empty files', async () => {
    const user = userEvent.setup();
    renderAudioUploader();
    
    const emptyFile = new File([], 'empty.mp3', { type: 'audio/mp3' });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, emptyFile);
    
    expect(toast.error).toHaveBeenCalledWith('File is empty');
    expect(screen.queryByText('empty.mp3')).not.toBeInTheDocument();
  });

  it('should handle drag and drop', async () => {
    renderAudioUploader();
    
    const file = new File(['audio content'], 'test.wav', { type: 'audio/wav' });
    const dropZone = screen.getByText(/Drag and drop your audio file here/).closest('div');
    
    // Simulate drag over
    fireEvent.dragOver(dropZone!, { dataTransfer: { files: [file] } });
    expect(dropZone).toHaveClass('border-primary');
    
    // Simulate drop
    fireEvent.drop(dropZone!, { 
      dataTransfer: { 
        files: [file],
        types: ['Files']
      } 
    });
    
    await waitFor(() => {
      expect(screen.getByText('test.wav')).toBeInTheDocument();
    });
  });

  it('should remove file when clicking remove button', async () => {
    const user = userEvent.setup();
    renderAudioUploader();
    
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, file);
    expect(screen.getByText('test.mp3')).toBeInTheDocument();
    
    const removeButton = screen.getByRole('button', { name: /remove file/i });
    await user.click(removeButton);
    
    expect(screen.queryByText('test.mp3')).not.toBeInTheDocument();
  });

  it('should process file when clicking process button', async () => {
    const user = userEvent.setup();
    vi.mocked(processAudioWithSummary).mockResolvedValue('note-123');
    
    renderAudioUploader();
    
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, file);
    
    const processButton = screen.getByRole('button', { name: /Process with AI/i });
    await user.click(processButton);
    
    expect(screen.getByText(/Processing audio/)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(processAudioWithSummary).toHaveBeenCalledWith(file, mockUser.id);
      expect(mockNavigate).toHaveBeenCalledWith('/notes/note-123');
    });
  });

  it('should handle processing errors', async () => {
    const user = userEvent.setup();
    vi.mocked(processAudioWithSummary).mockRejectedValue(new Error('Processing failed'));
    
    renderAudioUploader();
    
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, file);
    
    const processButton = screen.getByRole('button', { name: /Process with AI/i });
    await user.click(processButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Processing failed');
    });
  });

  it('should require authentication to process', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    } as any);
    
    const user = userEvent.setup();
    renderAudioUploader();
    
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
    const input = screen.getByLabelText('Choose audio file');
    
    await user.upload(input, file);
    
    const processButton = screen.getByRole('button', { name: /Process with AI/i });
    await user.click(processButton);
    
    expect(toast.error).toHaveBeenCalledWith('Please sign in to process audio files');
    expect(processAudioWithSummary).not.toHaveBeenCalled();
  });

  it('should format file size correctly', async () => {
    const user = userEvent.setup();
    renderAudioUploader();
    
    // 1.5 MB file
    const file = new File([new ArrayBuffer(1.5 * 1024 * 1024)], 'test.mp3', { 
      type: 'audio/mp3' 
    });
    Object.defineProperty(file, 'size', { value: 1.5 * 1024 * 1024 });
    
    const input = screen.getByLabelText('Choose audio file');
    await user.upload(input, file);
    
    expect(screen.getByText(/1\.50 MB/)).toBeInTheDocument();
  });

  it('should display file type correctly', async () => {
    const user = userEvent.setup();
    renderAudioUploader();
    
    const testCases = [
      { file: new File([''], 'test.mp3', { type: 'audio/mp3' }), expected: 'Audio/MP3' },
      { file: new File([''], 'test.wav', { type: 'audio/wav' }), expected: 'Audio/WAV' },
      { file: new File([''], 'test.m4a', { type: 'audio/m4a' }), expected: 'Audio/M4A' },
      { file: new File([''], 'test.webm', { type: 'audio/webm' }), expected: 'Audio/WebM' },
    ];
    
    for (const { file, expected } of testCases) {
      renderAudioUploader();
      const input = screen.getByLabelText('Choose audio file');
      await user.upload(input, file);
      expect(screen.getByText(new RegExp(expected, 'i'))).toBeInTheDocument();
      // Clean up for next iteration
      const removeButton = screen.getByRole('button', { name: /remove file/i });
      await user.click(removeButton);
    }
  });
});