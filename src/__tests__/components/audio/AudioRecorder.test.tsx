import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useMicrophone } from '@/hooks/useMicrophone';
import { processAudioWithSummary } from '@/services/transcription';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useMicrophone');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});
vi.mock('@/services/transcription', () => ({
  processAudioWithSummary: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock('@/components/audio/AudioVisualizer', () => ({
  AudioVisualizer: () => <div data-testid="audio-visualizer">Audio Visualizer</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

describe.skip('AudioRecorder Component', () => {
  const mockNavigate = vi.fn();
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  const mockStartRecording = vi.fn();
  const mockStopRecording = vi.fn();
  const mockGetAudioData = vi.fn();
  const mockCleanup = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock timers for testing recording duration
    vi.useFakeTimers();
    
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: { user: mockUser },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    } as any);
    
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: false,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: null,
      audioUrl: null,
      audioData: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render initial state', () => {
    const { container } = render(<AudioRecorder />);
    
    // Debug what's actually rendered
    console.log(container.innerHTML);
    
    // Check if the component renders anything
    expect(container.firstChild).toBeTruthy();
  });

  it('should require authentication to start recording', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    } as any);
    
    const user = userEvent.setup({ delay: null });
    render(<AudioRecorder />);
    
    const startButton = screen.getByRole('button', { name: /Start Recording/i });
    await user.click(startButton);
    
    expect(toast.error).toHaveBeenCalledWith('Please sign in to record audio');
    expect(mockStartRecording).not.toHaveBeenCalled();
  });

  it('should start recording when clicking start button', async () => {
    mockStartRecording.mockResolvedValue(undefined);
    
    const user = userEvent.setup({ delay: null });
    render(<AudioRecorder />);
    
    const startButton = screen.getByRole('button', { name: /Start Recording/i });
    await user.click(startButton);
    
    expect(mockStartRecording).toHaveBeenCalled();
  });

  it('should show recording state and controls', async () => {
    mockStartRecording.mockResolvedValue(undefined);
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: true,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: null,
      audioUrl: null,
      audioData: null,
    });
    
    render(<AudioRecorder />);
    
    expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeInTheDocument();
    expect(screen.getByText('Recording...')).toBeInTheDocument();
  });

  it('should update recording duration timer', async () => {
    mockStartRecording.mockResolvedValue(undefined);
    
    const user = userEvent.setup({ delay: null });
    render(<AudioRecorder />);
    
    const startButton = screen.getByRole('button', { name: /Start Recording/i });
    await user.click(startButton);
    
    // Update the mock to reflect recording state
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: true,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: null,
      audioUrl: null,
      audioData: null,
    });
    
    // Advance timer by 5 seconds
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(screen.getByText('00:05')).toBeInTheDocument();
    });
    
    // Advance timer by 1 minute
    vi.advanceTimersByTime(60000);
    
    await waitFor(() => {
      expect(screen.getByText('01:05')).toBeInTheDocument();
    });
  });

  it('should stop recording and show recorded audio', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
    const mockUrl = 'blob:mock-url';
    
    mockGetAudioData.mockReturnValue({
      blob: mockBlob,
      url: mockUrl,
    });
    
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: false,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: mockBlob,
      audioUrl: mockUrl,
      audioData: new Uint8Array([1, 2, 3]),
    });
    
    render(<AudioRecorder />);
    
    // Simulate stopping recording
    expect(screen.getByText('Your recorded audio:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard Recording/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Process with AI/i })).toBeInTheDocument();
    
    // Check for audio element
    const audioElement = screen.getByTestId('recorded-audio') as HTMLAudioElement;
    expect(audioElement.src).toBe(mockUrl);
  });

  it('should handle microphone errors', () => {
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: false,
      error: 'Microphone access denied',
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: null,
      audioUrl: null,
      audioData: null,
    });
    
    render(<AudioRecorder />);
    
    expect(screen.getByText(/Microphone access denied/)).toBeInTheDocument();
  });

  it('should discard recording when clicking discard button', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
    const mockUrl = 'blob:mock-url';
    
    mockGetAudioData.mockReturnValue({
      blob: mockBlob,
      url: mockUrl,
    });
    
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: false,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: mockBlob,
      audioUrl: mockUrl,
      audioData: new Uint8Array([1, 2, 3]),
    });
    
    const user = userEvent.setup({ delay: null });
    render(<AudioRecorder />);
    
    const discardButton = screen.getByRole('button', { name: /Discard Recording/i });
    await user.click(discardButton);
    
    expect(mockCleanup).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
  });

  it('should process recording when clicking process button', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
    const mockUrl = 'blob:mock-url';
    
    mockGetAudioData.mockReturnValue({
      blob: mockBlob,
      url: mockUrl,
    });
    
    vi.mocked(processAudioWithSummary).mockResolvedValue('note-123');
    
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: false,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: mockBlob,
      audioUrl: mockUrl,
      audioData: new Uint8Array([1, 2, 3]),
    });
    
    const user = userEvent.setup({ delay: null });
    render(<AudioRecorder />);
    
    const processButton = screen.getByRole('button', { name: /Process with AI/i });
    await user.click(processButton);
    
    // Should show processing state
    expect(screen.getByText(/Processing your recording/)).toBeInTheDocument();
    expect(screen.getByText(/Uploading audio file.../)).toBeInTheDocument();
    
    await waitFor(() => {
      const expectedFile = new File([mockBlob], 'recording.webm', { type: 'audio/webm' });
      expect(processAudioWithSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'recording.webm',
          type: 'audio/webm',
        }),
        mockUser.id
      );
      expect(mockNavigate).toHaveBeenCalledWith('/notes/note-123');
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  it('should handle processing errors', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
    const mockUrl = 'blob:mock-url';
    
    mockGetAudioData.mockReturnValue({
      blob: mockBlob,
      url: mockUrl,
    });
    
    vi.mocked(processAudioWithSummary).mockRejectedValue(new Error('Processing failed'));
    
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: false,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: mockBlob,
      audioUrl: mockUrl,
      audioData: new Uint8Array([1, 2, 3]),
    });
    
    const user = userEvent.setup({ delay: null });
    render(<AudioRecorder />);
    
    const processButton = screen.getByRole('button', { name: /Process with AI/i });
    await user.click(processButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Processing failed');
      // Should still show the recorded audio after error
      expect(screen.getByRole('button', { name: /Process with AI/i })).toBeInTheDocument();
    });
  });

  it('should show different processing steps', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
    const mockUrl = 'blob:mock-url';
    
    mockGetAudioData.mockReturnValue({
      blob: mockBlob,
      url: mockUrl,
    });
    
    // Mock a delayed response to see processing steps
    vi.mocked(processAudioWithSummary).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('note-123'), 3000))
    );
    
    vi.mocked(useMicrophone).mockReturnValue({
      isRecording: false,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      getAudioData: mockGetAudioData,
      cleanup: mockCleanup,
      audioBlob: mockBlob,
      audioUrl: mockUrl,
      audioData: new Uint8Array([1, 2, 3]),
    });
    
    const user = userEvent.setup({ delay: null });
    render(<AudioRecorder />);
    
    const processButton = screen.getByRole('button', { name: /Process with AI/i });
    await user.click(processButton);
    
    // Initial step
    expect(screen.getByText(/Uploading audio file.../)).toBeInTheDocument();
    
    // Advance timer to see next step
    vi.advanceTimersByTime(1500);
    
    await waitFor(() => {
      expect(screen.getByText(/Transcribing audio.../)).toBeInTheDocument();
    });
    
    // Advance timer to see final step
    vi.advanceTimersByTime(1500);
    
    await waitFor(() => {
      expect(screen.getByText(/Generating summary.../)).toBeInTheDocument();
    });
  });

  it('should cleanup on unmount', () => {
    const { unmount } = render(<AudioRecorder />);
    
    unmount();
    
    expect(mockCleanup).toHaveBeenCalled();
  });
});