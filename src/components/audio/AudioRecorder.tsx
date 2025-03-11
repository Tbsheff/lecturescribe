
import React, { useState } from 'react';
import { Mic, StopCircle, Trash, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AudioVisualizer } from './AudioVisualizer';
import { useMicrophone } from '@/hooks/useMicrophone';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onAudioSaved: (blob: Blob) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onAudioSaved 
}) => {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    audioBlob, 
    audioUrl, 
    error, 
    audioData 
  } = useMicrophone();
  
  const handleStartRecording = async () => {
    await startRecording();
    
    // Start duration counter
    const interval = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
    
    setRecordingInterval(interval);
  };
  
  const handleStopRecording = () => {
    stopRecording();
    
    // Clear interval
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
  
  const handleSave = () => {
    if (audioBlob) {
      onAudioSaved(audioBlob);
      toast.success('Audio saved successfully');
      handleReset();
    }
  };
  
  // Format duration as mm:ss
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
          
          <div className="flex gap-3 mt-6">
            {!isRecording && !audioUrl && (
              <Button 
                variant="default"
                className="bg-brand hover:bg-brand-dark text-white gap-2"
                onClick={handleStartRecording}
                disabled={isRecording}
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
              >
                <StopCircle className="w-4 h-4" />
                Stop Recording
              </Button>
            )}
            
            {audioUrl && !isRecording && (
              <>
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={handleReset}
                >
                  <Trash className="w-4 h-4" />
                  Discard
                </Button>
                
                <Button 
                  variant="default"
                  className="bg-brand hover:bg-brand-dark text-white gap-2"
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4" />
                  Save Recording
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
