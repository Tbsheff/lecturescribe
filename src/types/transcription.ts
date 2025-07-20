/**
 * TypeScript interfaces for audio transcription and AI summarization
 */

// Audio file types supported by the system
export type SupportedAudioType = 
  | 'audio/wav' 
  | 'audio/mp3' 
  | 'audio/mpeg' 
  | 'audio/mp4' 
  | 'audio/x-m4a' 
  | 'audio/webm';

// Audio file extensions supported
export type SupportedAudioExtension = 'wav' | 'wave' | 'mp3' | 'mpeg' | 'm4a' | 'mp4' | 'webm';

// Transcription service options
export interface TranscriptionOptions {
  audioFile: File;
  userId: string;
}

// Note metadata for transcription
export interface NoteMetadata {
  title: string;
  description?: string;
  tags?: string[];
  folderId?: string | null;
}

// Edge function request payload
export interface EdgeFunctionRequest {
  audioUrl: string;
  contentType: string;
  fileName: string;
}

// Edge function response from summarize-audio
export interface EdgeFunctionResponse {
  transcription: string;
  summary: string;
  confidence?: number;
  processing_time?: number;
  model_used?: string;
  language_detected?: string;
}

// Audio processing result
export interface AudioProcessingResult {
  transcription: string;
  summary: string;
  fileUrl: string;
  confidence?: number;
  processingTimeMs?: number;
  modelUsed?: string;
}

// Transcription result with error handling
export interface TranscriptionResult {
  transcription: string;
  error: string | null;
  confidence?: number;
}

// Complete audio processing with note creation
export interface AudioWithNoteResult {
  transcription: string;
  summary: string;
  noteId: string;
  confidence?: number;
}

// Storage upload configuration
export interface StorageUploadConfig {
  contentType: string;
  cacheControl: string;
  upsert: boolean;
}

// File validation result
export interface FileValidationResult {
  isValid: boolean;
  contentType: string;
  error?: string;
}

// Audio processing error types
export type AudioProcessingError = 
  | 'INVALID_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'UPLOAD_FAILED'
  | 'PROCESSING_FAILED'
  | 'EMPTY_TRANSCRIPTION'
  | 'NOTE_SAVE_FAILED'
  | 'CLEANUP_FAILED';

// Audio processing error with details
export interface AudioProcessingErrorDetails {
  type: AudioProcessingError;
  message: string;
  originalError?: Error;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
}

// Environment configuration
export interface TranscriptionEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isDevelopment: boolean;
  useMockTranscription: boolean;
}

// Audio file validation constraints
export interface AudioValidationConstraints {
  maxFileSizeBytes: number;
  minFileSizeBytes: number;
  supportedTypes: SupportedAudioType[];
  supportedExtensions: SupportedAudioExtension[];
}

// Processing statistics
export interface ProcessingStats {
  uploadTimeMs: number;
  processingTimeMs: number;
  totalTimeMs: number;
  fileSizeBytes: number;
  transcriptionLength: number;
  summaryLength: number;
}

// Mock transcription configuration for development
export interface MockTranscriptionConfig {
  enabled: boolean;
  transcription: string;
  summary: string;
  delay?: number;
}