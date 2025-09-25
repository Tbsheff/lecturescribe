import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Mic, 
  MicOff, 
  Settings, 
  Save, 
  Trash2, 
  WifiOff, 
  Wifi, 
  Volume2,
  Loader2,
  Copy,
  Download
} from 'lucide-react';
import { useRealtimeTranscription, StreamingTranscriptionOptions } from '@/hooks/useRealtimeTranscription';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { processAudioWithSummary } from '@/services/transcription';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

const MODEL_OPTIONS = [
  { value: 'nova-2', label: 'Nova-2 (Recommended)', description: 'Best balance of speed and accuracy' },
  { value: 'nova-3', label: 'Nova-3 (Premium)', description: 'Latest model with advanced features' },
  { value: 'base', label: 'Base', description: 'Fast and cost-effective' },
];

export const RealtimeTranscription: React.FC = () => {
  const { user } = useAuth();
  const [options, setOptions] = useState<StreamingTranscriptionOptions>({
    model: 'nova-2',
    language: 'en-US',
    interim_results: true,
    punctuate: true,
    smart_format: true,
    diarize: false,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const {
    isConnecting,
    isConnected,
    isRecording,
    transcript,
    interimTranscript,
    words,
    error,
    connectionId,
    connect,
    startRecording,
    stopRecording,
    disconnect,
    clearTranscript,
    fullTranscript
  } = useRealtimeTranscription(options);

  // Auto-connect on component mount
  useEffect(() => {
    if (!isConnected && !isConnecting) {
      connect();
    }
  }, [connect, isConnected, isConnecting]);

  // Track session time
  useEffect(() => {
    if (isRecording && !sessionStartTime) {
      setSessionStartTime(new Date());
    } else if (!isRecording && sessionStartTime) {
      setSessionStartTime(null);
    }
  }, [isRecording, sessionStartTime]);

  const handleStartRecording = async () => {
    if (!user) {
      toast.error('Please sign in to use real-time transcription');
      return;
    }

    try {
      await startRecording();
    } catch (error) {
      toast.error('Failed to start recording');
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleSaveTranscript = async () => {
    if (!user || !fullTranscript.trim()) {
      toast.error('No transcript to save');
      return;
    }

    setIsSaving(true);
    try {
      // Create a blob from the transcript text
      const textBlob = new Blob([fullTranscript], { type: 'text/plain' });
      const audioFile = new File([textBlob], 'realtime-transcript.txt', { type: 'text/plain' });
      
      const metadata = {
        title: `Real-time Transcript ${new Date().toLocaleString()}`,
        type: 'realtime',
        duration: sessionStartTime ? Date.now() - sessionStartTime.getTime() : 0,
        words: words.length,
        connectionId,
        model: options.model,
        language: options.language
      };

      // Use the existing transcription service to save
      await processAudioWithSummary(audioFile, user.id, metadata, 'deepgram');
      
      toast.success('Transcript saved successfully!');
      clearTranscript();
      
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast.error('Failed to save transcript');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (!fullTranscript.trim()) {
      toast.error('No transcript to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(fullTranscript);
      toast.success('Transcript copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy transcript');
    }
  };

  const handleDownloadTranscript = () => {
    if (!fullTranscript.trim()) {
      toast.error('No transcript to download');
      return;
    }

    const blob = new Blob([fullTranscript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realtime-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Transcript downloaded');
  };

  const getConnectionStatus = () => {
    if (isConnecting) return { icon: Loader2, color: 'orange', text: 'Connecting...', spin: true };
    if (isConnected) return { icon: Wifi, color: 'green', text: 'Connected', spin: false };
    return { icon: WifiOff, color: 'red', text: 'Disconnected', spin: false };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center space-x-2">
                <Volume2 className="h-5 w-5" />
                <span>Real-time Transcription</span>
                <Badge variant="secondary">Deepgram</Badge>
              </CardTitle>
              <CardDescription>
                Live speech-to-text transcription with advanced AI
              </CardDescription>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <StatusIcon 
                  className={`h-4 w-4 text-${status.color}-500 ${status.spin ? 'animate-spin' : ''}`} 
                />
                <span className={`text-sm text-${status.color}-600`}>
                  {status.text}
                </span>
              </div>
              
              {/* Settings Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Settings Panel */}
          {showSettings && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium">Transcription Settings</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={options.model}
                    onValueChange={(value) => setOptions(prev => ({ ...prev, model: value as any }))}
                    disabled={isRecording}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map(model => (
                        <SelectItem key={model.value} value={model.value}>
                          <div>
                            <div className="font-medium">{model.label}</div>
                            <div className="text-xs text-muted-foreground">{model.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={options.language}
                    onValueChange={(value) => setOptions(prev => ({ ...prev, language: value }))}
                    disabled={isRecording}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="punctuate"
                    checked={options.punctuate}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, punctuate: checked }))}
                    disabled={isRecording}
                  />
                  <Label htmlFor="punctuate">Smart Punctuation</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="diarize"
                    checked={options.diarize}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, diarize: checked }))}
                    disabled={isRecording}
                  />
                  <Label htmlFor="diarize">Speaker Detection</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="interim"
                    checked={options.interim_results}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, interim_results: checked }))}
                    disabled={isRecording}
                  />
                  <Label htmlFor="interim">Live Updates</Label>
                </div>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex items-center justify-center space-x-4">
            {!isRecording ? (
              <Button
                size="lg"
                onClick={handleStartRecording}
                disabled={!isConnected || isConnecting}
                className="px-8"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                size="lg"
                variant="destructive"
                onClick={handleStopRecording}
                className="px-8"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Stop Recording
              </Button>
            )}

            {transcript && (
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={clearTranscript}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                
                <Button variant="outline" onClick={handleCopyTranscript}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                
                <Button variant="outline" onClick={handleDownloadTranscript}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                
                <Button 
                  onClick={handleSaveTranscript}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Note
                </Button>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Live Transcript</CardTitle>
            {sessionStartTime && (
              <Badge variant="outline">
                Session: {Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)}s
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="min-h-[300px] max-h-[600px] overflow-y-auto p-4 bg-muted/30 rounded-lg border">
            {fullTranscript ? (
              <div className="space-y-2">
                {/* Final transcript */}
                {transcript && (
                  <p className="text-foreground leading-relaxed">
                    {transcript}
                  </p>
                )}
                
                {/* Interim results */}
                {interimTranscript && (
                  <>
                    {transcript && <Separator className="my-2" />}
                    <p className="text-muted-foreground italic leading-relaxed">
                      {interimTranscript}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center space-y-2">
                  <Mic className="h-12 w-12 mx-auto opacity-50" />
                  <p>Start recording to see live transcription</p>
                  <p className="text-sm">
                    {isConnected ? 'Ready to transcribe' : 'Connecting to transcription service...'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          {(words.length > 0 || isRecording) && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <div className="space-x-4">
                <span>Words: {words.length}</span>
                <span>Characters: {fullTranscript.length}</span>
              </div>
              
              {isRecording && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span>Recording...</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};