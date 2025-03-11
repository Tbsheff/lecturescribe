import React, { useState, useRef, useEffect } from 'react';
import { Button, Card, CardContent, Typography, LinearProgress, Box } from '@mui/material';
import {
  MicIcon,
  StopIcon,
  PlayArrowIcon,
  PauseIcon,
  SaveIcon,
  DeleteIcon,
  RefreshIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { transcribeAudio, processAudioWithSummary } from '@/services/transcriptionService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AudioRecorderProps {
  onAudioSaved?: (blob: Blob) => void;
  onProcessingComplete?: (data: {
    transcription: string;
    summary: string;
    noteId: string;
  }) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioSaved,
  onProcessingComplete,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);
  
  const startRecording = async () => {
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        audioPlayerRef.current = new Audio(URL.createObjectURL(audioBlob));
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error('Error accessing microphone');
    }
  };
  
  const handleSave = async () => {
    if (!audioBlob) {
      toast.error('No recording available');
      return;
    }
    
    try {
      setIsProcessing(true);
      setProcessingStep('Processing audio...');
      setProcessingProgress(10);
      
      // Use our combined function to process audio
      const userId = user?.id || 'anonymous';
      const metadata = {
        title: `Recording ${new Date().toLocaleString()}`,
        // Add any additional metadata here
      };
      
      setProcessingStep('Transcribing audio...');
      setProcessingProgress(30);
      
      const result = await processAudioWithSummary(
        new File([audioBlob], 'recording.wav', { type: 'audio/wav' }),
        userId,
        metadata
      );
      
      setProcessingStep('Saving note...');
      setProcessingProgress(90);
      
      // Handle successful processing
      if (onProcessingComplete) {
        onProcessingComplete(result);
      }
      
      setProcessingProgress(100);
      toast.success('Note created successfully');
      
      if (onAudioSaved) {
        onAudioSaved(audioBlob);
      }
      
      // Optionally navigate to the note view
      navigate(`/notes/${result.noteId}`);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Failed to process audio');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStep('');
      handleReset();
    }
  };
  
  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };
  
  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    
    if (isPlaying) {
      audioPlayerRef.current.pause();
    } else {
      audioPlayerRef.current.play();
      
      audioPlayerRef.current.onended = () => {
        setIsPlaying(false);
      };
    }
    
    setIsPlaying(!isPlaying);
  };
  
  const handleReset = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    
    setIsRecording(false);
    setIsPlaying(false);
    setRecordingTime(0);
    setAudioBlob(null);
    audioChunksRef.current = [];
  };
  
  return (
    <Card variant="outlined" sx={{ maxWidth: '600px', margin: '0 auto' }}>
      <CardContent>
        <Typography variant="h6" align="center" gutterBottom>
          Audio Recorder
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <Typography variant="h5" color="primary">
            {formatDuration(recordingTime)}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
          {!isRecording && !audioBlob ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<MicIcon />}
              onClick={startRecording}
              disabled={isProcessing}
            >
              Record
            </Button>
          ) : isRecording ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={stopRecording}
            >
              Stop
            </Button>
          ) : null}
          
          {audioBlob && !isRecording && (
            <>
              <Button
                variant="outlined"
                color="primary"
                startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                onClick={togglePlayback}
                disabled={isProcessing}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              
              <Button
                variant="contained"
                color="secondary"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={isProcessing}
              >
                Save
              </Button>
              
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleReset}
                disabled={isProcessing}
              >
                Delete
              </Button>
            </>
          )}
        </Box>
        
        {isProcessing && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="body2" align="center" gutterBottom>
              {processingStep}
            </Typography>
            <LinearProgress variant="determinate" value={processingProgress} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
