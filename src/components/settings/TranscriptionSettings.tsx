import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const TranscriptionSettings: React.FC = () => {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <CardTitle>Transcription Settings</CardTitle>
        </div>
        <CardDescription>
          Audio transcription configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Transcription providers are now managed on the server for improved security.
            The system will automatically use the best available provider for your audio files.
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground">
          <p>Supported features:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Automatic transcription of audio files</li>
            <li>AI-powered summarization</li>
            <li>Support for multiple audio formats (MP3, WAV, M4A, WebM)</li>
            <li>Real-time transcription capabilities</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};