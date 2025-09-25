// Shared types for transcription services (edge function compatible)

export interface TranscriptionResult {
  transcription: string;
  summary: string;
  notes?: string;
  keyPoints?: string[];
  confidence?: number;
  language?: string;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
  summarize?: boolean;
  includeKeyPoints?: boolean;
  customPrompt?: string;
}

export interface AudioFile {
  buffer?: ArrayBuffer;
  mimeType: string;
  filename?: string;
  url?: string;
}

export abstract class TranscriptionProvider {
  abstract name: string;
  abstract isAvailable(): boolean;
  abstract transcribeAudio(audio: AudioFile, options?: TranscriptionOptions): Promise<TranscriptionResult>;
}

export type TranscriptionProviderType = 'deepgram' | 'gemini';

export interface TranscriptionConfig {
  provider: TranscriptionProviderType;
  deepgram?: {
    apiKey: string;
    model?: string;
    language?: string;
  };
  gemini?: {
    apiKey: string;
    model?: string;
  };
  fallbackProvider?: TranscriptionProviderType;
}