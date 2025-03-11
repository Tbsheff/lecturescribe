
import React, { useState, useRef } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { transcribeAudio, summarizeTranscription } from '@/services/transcription';

interface AudioUploaderProps {
  onAudioUploaded: (file: File) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ 
  onAudioUploaded 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check file type
      if (!selectedFile.type.startsWith('audio/')) {
        toast.error('Please upload an audio file');
        return;
      }
      
      // Check file size (max 100MB)
      if (selectedFile.size > 100 * 1024 * 1024) {
        toast.error('File is too large. Maximum size is 100MB');
        return;
      }
      
      setFile(selectedFile);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      if (!droppedFile.type.startsWith('audio/')) {
        toast.error('Please upload an audio file');
        return;
      }
      
      if (droppedFile.size > 100 * 1024 * 1024) {
        toast.error('File is too large. Maximum size is 100MB');
        return;
      }
      
      setFile(droppedFile);
    }
  };
  
  const handleSubmit = async () => {
    if (file) {
      try {
        setIsProcessing(true);
        
        // Step 1: Transcribe audio
        setProcessingStep('Transcribing audio...');
        const transcription = await transcribeAudio(file);
        
        // Step 2: Summarize using Gemini
        setProcessingStep('Generating AI summary...');
        const summary = await summarizeTranscription(transcription.text);
        
        // Step 3: Return the file and processed data
        onAudioUploaded(file);
        
        // Save in localStorage for demo purposes (in a real app, this would go to Supabase)
        localStorage.setItem('lastSummary', JSON.stringify(summary));
        
        toast.success('Audio processed successfully with AI');
        setFile(null);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      } catch (error: any) {
        console.error('Processing error:', error);
        toast.error(`Processing failed: ${error.message}`);
      } finally {
        setIsProcessing(false);
        setProcessingStep('');
      }
    }
  };
  
  const handleRemoveFile = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto bg-card/60 backdrop-blur-sm border border-border/50 shadow-sm">
      <CardContent className="pt-6">
        {!file ? (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? 'border-brand bg-brand/5'
                : 'border-border hover:border-brand/50 hover:bg-accent/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">Upload Audio File</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Drag and drop an audio file, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supported formats: MP3, WAV, M4A (Max. 100MB)
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              Browse Files
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="audio/*"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center">
              <div className="mr-4 p-2 bg-secondary rounded-md">
                <File className="h-8 w-8 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={handleRemoveFile}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{processingStep}</span>
              </div>
            )}
            
            <Button
              className="w-full mt-4 bg-brand hover:bg-brand-dark text-white"
              onClick={handleSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Process with AI'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
