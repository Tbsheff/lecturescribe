import React, { useState, useEffect } from 'react';
import { Mic, StopCircle, Trash, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AudioVisualizer } from './AudioVisualizer';
import { useMicrophone } from '@/hooks/useMicrophone';
import { toast } from 'sonner';
import { processAudioWithSummary } from '@/services/transcription';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AudioRecorderProps {
  onAudioSaved?: (blob: Blob) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onAudioSaved 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    audioBlob, 
    audioUrl, 
    error, 
    audioData 
  } = useMicrophone();

  useEffect(() => {
    return () => {
      if (recordingInterval) {
        clearInterval(recordingInterval);
      }
    };
  }, [recordingInterval]);
  
  const handleStartRecording = async () => {
    if (!user) {
      toast.error('Please sign in to record audio');
      navigate('/auth');
      return;
    }
    
    await startRecording();
    
    const interval = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
    
    setRecordingInterval(interval);
  };
  
  const handleStopRecording = () => {
    stopRecording();
    
    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }
  };
  
  const handleReset = () => {
    setRecordingDuration(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };
  
  const handleSave = async () => {
    if (!audioBlob || !user) return;

    try {
      setIsProcessing(true);
      setProcessingStep('Processing audio...');

      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      const metadata = {
        title: `Recording ${new Date().toLocaleTimeString()}`,
        duration: recordingDuration,
        format: 'wav',
        size: audioBlob.size,
      };

      const { noteId } = await processAudioWithSummary(audioFile, user.id, metadata);
      
      onAudioSaved && onAudioSaved(audioBlob);
      
      navigate(`/notes/${noteId}`);
      
      toast.success('Recording processed successfully!');
    } catch (error: any) {
      console.error('Processing error:', error);
      toast.error(`Failed to process recording: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };
  
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto bg-card/60 backdrop-blur-sm border border-border/50 shadow-sm transition-all duration-300">
      <CardContent className="pt-6">
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}
        
        <div className="flex flex-col items-center">
          <div className="relative w-16 h-16 flex items-center justify-center bg-secondary rounded-full mb-4">
            {isRecording && (
              <div className="absolute inset-0 bg-brand/20 rounded-full animate-pulse"></div>
            )}
            <Mic className={`w-6 h-6 ${isRecording ? 'text-brand' : 'text-muted-foreground'}`} />
          </div>
          
          <h3 className="text-lg font-medium mb-1">
            {isRecording ? 'Recording...' : audioUrl ? 'Recording Complete' : 'Record Audio'}
          </h3>
          
          {isRecording && (
            <div className="text-sm text-muted-foreground mb-4">
              {formatDuration(recordingDuration)}
            </div>
          )}
          
          <AudioVisualizer audioData={audioData} isRecording={isRecording} />
          
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{processingStep}</span>
            </div>
          )}
          
          <div className="flex gap-3 mt-6">
            {!isRecording && !audioUrl && !isProcessing && (
              <Button 
                variant="default"
                className="bg-brand hover:bg-brand-dark text-white gap-2"
                onClick={handleStartRecording}
                disabled={isRecording || isProcessing}
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </Button>
            )}
            
            {isRecording && (
              <Button 
                variant="destructive"
                className="gap-2"
                onClick={handleStopRecording}
                disabled={isProcessing}
              >
                <StopCircle className="w-4 h-4" />
                Stop Recording
              </Button>
            )}
            
            {audioUrl && !isRecording && !isProcessing && (
              <>
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  <Trash className="w-4 h-4" />
                  Discard
                </Button>
                
                <Button 
                  variant="default"
                  className="bg-brand hover:bg-brand-dark text-white gap-2"
                  onClick={handleSave}
                  disabled={isProcessing}
                >
                  <Save className="w-4 h-4" />
                  Process with AI
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
