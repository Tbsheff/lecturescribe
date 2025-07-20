/**
 * Unified Audio Transcription Service
 * Consolidates transcription.ts and transcriptionService.ts with comprehensive features
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  TranscriptionOptions,
  NoteMetadata,
  EdgeFunctionRequest,
  EdgeFunctionResponse,
  AudioProcessingResult,
  TranscriptionResult,
  AudioWithNoteResult,
  FileValidationResult,
  AudioProcessingErrorDetails,
  SupportedAudioType,
  SupportedAudioExtension,
  StorageUploadConfig
} from '@/types/transcription';

// Configuration constants
const AUDIO_VALIDATION = {
  maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
  minFileSizeBytes: 1024, // 1KB
  supportedTypes: [
    'audio/wav',
    'audio/mp3', 
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/webm'
  ] as SupportedAudioType[],
  supportedExtensions: [
    'wav', 'wave', 'mp3', 'mpeg', 'm4a', 'mp4', 'webm'
  ] as SupportedAudioExtension[]
};

const STORAGE_CONFIG = {
  bucket: 'audio_uploads',
  tempPath: 'temp_audio',
  cacheControl: '3600'
};

const MOCK_CONFIG = {
  transcription: 'This is a mock transcription for development purposes.',
  summary: 'Mock summary: Audio processing is not available in development mode.',
  delay: 1000
};

// Custom error class for audio processing
export class AudioProcessingError extends Error {
  public readonly details: AudioProcessingErrorDetails;

  constructor(details: AudioProcessingErrorDetails) {
    super(details.message);
    this.name = 'AudioProcessingError';
    this.details = details;
  }
}

// Logging utility
const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[TranscriptionService] ${message}`, data || '');
  },
  error: (message: string, error?: unknown) => {
    console.error(`[TranscriptionService] ${message}`, error || '');
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[TranscriptionService] ${message}`, data || '');
  }
};

/**
 * Validates audio file format and size
 */
export function validateAudioFile(file: File): FileValidationResult {
  // Check if file exists and has content
  if (!file || file.size === 0) {
    return {
      isValid: false,
      contentType: '',
      error: 'Invalid or empty audio file'
    };
  }

  // Check file size constraints
  if (file.size < AUDIO_VALIDATION.minFileSizeBytes) {
    return {
      isValid: false,
      contentType: file.type,
      error: `File too small. Minimum size: ${AUDIO_VALIDATION.minFileSizeBytes} bytes`
    };
  }

  if (file.size > AUDIO_VALIDATION.maxFileSizeBytes) {
    return {
      isValid: false,
      contentType: file.type,
      error: `File too large. Maximum size: ${AUDIO_VALIDATION.maxFileSizeBytes / (1024 * 1024)}MB`
    };
  }

  // Determine content type
  let contentType = file.type;
  
  // If type is not explicitly supported, try to determine from extension
  if (!AUDIO_VALIDATION.supportedTypes.includes(contentType as SupportedAudioType)) {
    const extension = file.name.split('.').pop()?.toLowerCase() as SupportedAudioExtension;
    
    if (!extension || !AUDIO_VALIDATION.supportedExtensions.includes(extension)) {
      return {
        isValid: false,
        contentType: file.type,
        error: `Unsupported file type: ${extension || 'unknown'}. Supported formats: ${AUDIO_VALIDATION.supportedExtensions.join(', ')}`
      };
    }

    // Map extension to content type
    const extensionToType: Record<SupportedAudioExtension, SupportedAudioType> = {
      'wav': 'audio/wav',
      'wave': 'audio/wav',
      'mp3': 'audio/mpeg',
      'mpeg': 'audio/mpeg',
      'm4a': 'audio/x-m4a',
      'mp4': 'audio/mp4',
      'webm': 'audio/webm'
    };

    contentType = extensionToType[extension];
    logger.info(`Determined content type ${contentType} from extension ${extension}`);
  }

  return {
    isValid: true,
    contentType,
    error: undefined
  };
}

/**
 * Generates a unique filename for audio upload
 */
function generateAudioFilename(originalFile: File): string {
  const timestamp = Date.now();
  const extension = originalFile.name.split('.').pop()?.toLowerCase() || 'wav';
  return `audio_${timestamp}.${extension}`;
}

/**
 * Creates storage upload configuration
 */
function createUploadConfig(contentType: string): StorageUploadConfig {
  return {
    contentType,
    cacheControl: STORAGE_CONFIG.cacheControl,
    upsert: false
  };
}

/**
 * Checks if development mode mock should be used
 */
function shouldUseMockTranscription(): boolean {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !supabaseUrl || !supabaseKey || supabaseUrl.trim() === '' || supabaseKey.trim() === '';
}

/**
 * Processes audio file through Supabase storage and Edge function
 */
export async function processAudioInSupabase(audioFile: File): Promise<AudioProcessingResult> {
  const startTime = Date.now();
  
  logger.info('Starting audio processing', {
    name: audioFile.name,
    type: audioFile.type,
    size: audioFile.size,
    lastModified: new Date(audioFile.lastModified).toISOString()
  });

  // Validate file
  const validation = validateAudioFile(audioFile);
  if (!validation.isValid) {
    throw new AudioProcessingError({
      type: 'INVALID_FILE',
      message: validation.error!,
      fileInfo: {
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type
      }
    });
  }

  // Generate filename and path
  const filename = generateAudioFilename(audioFile);
  const filePath = `${STORAGE_CONFIG.tempPath}/${filename}`;
  const uploadConfig = createUploadConfig(validation.contentType);

  logger.info(`Uploading file to storage: ${filePath} (${validation.contentType})`);

  let publicUrl = '';
  let uploadTime = 0;

  try {
    // 1. Upload file to Supabase Storage
    const uploadStart = Date.now();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_CONFIG.bucket)
      .upload(filePath, audioFile, uploadConfig);

    uploadTime = Date.now() - uploadStart;

    if (uploadError) {
      logger.error('Storage upload failed', uploadError);
      throw new AudioProcessingError({
        type: 'UPLOAD_FAILED',
        message: `Failed to upload audio file: ${uploadError.message}`,
        originalError: uploadError,
        fileInfo: {
          name: audioFile.name,
          size: audioFile.size,
          type: audioFile.type
        }
      });
    }

    logger.info('File uploaded successfully', { path: uploadData.path, uploadTimeMs: uploadTime });

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_CONFIG.bucket)
      .getPublicUrl(filePath);

    publicUrl = urlData.publicUrl;
    logger.info('Generated public URL', { url: publicUrl });

    // 3. Call Edge Function for AI processing
    const processingStart = Date.now();
    logger.info('Calling Edge function for AI processing');

    const edgeRequest: EdgeFunctionRequest = {
      audioUrl: publicUrl,
      contentType: validation.contentType,
      fileName: filename
    };

    const { data, error } = await supabase.functions.invoke('summarize-audio', {
      body: edgeRequest
    });

    const processingTime = Date.now() - processingStart;

    if (error) {
      logger.error('Edge function processing failed', error);
      throw new AudioProcessingError({
        type: 'PROCESSING_FAILED',
        message: `Failed to process audio: ${error.message}`,
        originalError: error,
        fileInfo: {
          name: audioFile.name,
          size: audioFile.size,
          type: audioFile.type
        }
      });
    }

    const response = data as EdgeFunctionResponse;

    // Validate transcription result
    if (!response?.transcription || response.transcription.trim().length === 0) {
      logger.error('Empty transcription received', { response });
      throw new AudioProcessingError({
        type: 'EMPTY_TRANSCRIPTION',
        message: 'No transcription received from processing service',
        fileInfo: {
          name: audioFile.name,
          size: audioFile.size,
          type: audioFile.type
        }
      });
    }

    const totalTime = Date.now() - startTime;

    logger.info('Audio processing completed successfully', {
      transcriptionLength: response.transcription.length,
      summaryLength: response.summary?.length || 0,
      processingTimeMs: processingTime,
      totalTimeMs: totalTime
    });

    // 4. Clean up temporary file
    try {
      await supabase.storage.from(STORAGE_CONFIG.bucket).remove([filePath]);
      logger.info('Temporary file cleaned up successfully');
    } catch (cleanupError) {
      logger.warn('File cleanup failed', cleanupError);
      // Don't throw on cleanup errors
    }

    return {
      transcription: response.transcription,
      summary: response.summary || '',
      fileUrl: publicUrl,
      confidence: response.confidence,
      processingTimeMs: processingTime,
      modelUsed: response.model_used
    };

  } catch (error) {
    logger.error('Audio processing failed', error);

    // Attempt cleanup on error
    if (publicUrl) {
      try {
        await supabase.storage.from(STORAGE_CONFIG.bucket).remove([filePath]);
        logger.info('Cleanup completed after error');
      } catch (cleanupError) {
        logger.warn('Cleanup failed after error', cleanupError);
      }
    }

    // Re-throw AudioProcessingError as-is, wrap others
    if (error instanceof AudioProcessingError) {
      throw error;
    }

    throw new AudioProcessingError({
      type: 'PROCESSING_FAILED',
      message: `Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      originalError: error instanceof Error ? error : undefined,
      fileInfo: {
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type
      }
    });
  }
}

/**
 * Simple transcription function that returns just the transcribed text
 * Compatible with both old service signatures
 */
export async function transcribeAudio(options: TranscriptionOptions | File): Promise<TranscriptionResult | string> {
  try {
    // Handle both old and new function signatures
    let audioFile: File;
    let userId: string | undefined;

    if (options instanceof File) {
      // Old signature: transcribeAudio(audioFile: File): Promise<string>
      audioFile = options;
      userId = undefined;
    } else {
      // New signature: transcribeAudio({ audioFile, userId }: TranscriptionOptions): Promise<TranscriptionResult>
      audioFile = options.audioFile;
      userId = options.userId;
    }

    // Check for mock mode
    if (shouldUseMockTranscription()) {
      logger.info('Using mock transcription for development');
      
      // Simulate processing time
      if (MOCK_CONFIG.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, MOCK_CONFIG.delay));
      }

      // Return appropriate format based on signature
      if (userId !== undefined) {
        return {
          transcription: MOCK_CONFIG.transcription,
          error: null
        };
      } else {
        return MOCK_CONFIG.transcription;
      }
    }

    // Process with real service
    const result = await processAudioInSupabase(audioFile);
    
    // Return appropriate format based on signature
    if (userId !== undefined) {
      return {
        transcription: result.transcription,
        error: null,
        confidence: result.confidence
      };
    } else {
      return result.transcription;
    }

  } catch (error) {
    logger.error('Transcription failed', error);
    
    const errorMessage = error instanceof AudioProcessingError 
      ? error.message 
      : `Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`;

    // Return appropriate format based on signature
    if (typeof options !== 'object' || !('userId' in options)) {
      // Old signature - throw error
      throw new Error(errorMessage);
    } else {
      // New signature - return error result
      return {
        transcription: '',
        error: errorMessage
      };
    }
  }
}

/**
 * Complete audio processing with note creation
 */
export async function processAudioWithSummary(
  audioFile: File,
  userId: string,
  metadata: NoteMetadata
): Promise<AudioWithNoteResult> {
  logger.info('Processing audio with summary and note creation', { userId, metadata });

  try {
    // Process audio
    const result = await processAudioInSupabase(audioFile);
    
    // Save note to database
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: metadata.title,
        transcription: result.transcription,
        raw_summary: result.summary,
        audio_url: result.fileUrl,
        folder_id: metadata.folderId || null
      })
      .select()
      .single();

    if (noteError) {
      logger.error('Failed to save note', noteError);
      throw new AudioProcessingError({
        type: 'NOTE_SAVE_FAILED',
        message: `Failed to save note: ${noteError.message}`,
        originalError: noteError,
        fileInfo: {
          name: audioFile.name,
          size: audioFile.size,
          type: audioFile.type
        }
      });
    }
    
    logger.info('Note saved successfully', { noteId: noteData.id, title: metadata.title });

    return {
      transcription: result.transcription,
      summary: result.summary,
      noteId: noteData.id,
      confidence: result.confidence
    };

  } catch (error) {
    logger.error('Audio processing with summary failed', error);
    
    if (error instanceof AudioProcessingError) {
      throw error;
    }

    throw new AudioProcessingError({
      type: 'PROCESSING_FAILED',
      message: `Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      originalError: error instanceof Error ? error : undefined,
      fileInfo: {
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type
      }
    });
  }
}

/**
 * Fetch all notes for a user
 */
export async function fetchNotes() {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((note: Record<string, unknown>) => ({
      id: note.id,
      title: note.title || 'Untitled Note',
      date: new Date(note.created_at),
      preview: note.raw_summary || note.transcription?.substring(0, 100) || 'No content available'
    }));
  } catch (error) {
    logger.error('Error fetching notes', error);
    throw new Error('Failed to fetch notes');
  }
}

/**
 * Fetch a single note by ID
 */
export async function fetchNoteById(noteId: string) {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (error) {
      logger.error('Supabase fetch note by ID error', error);
      throw new Error(`Failed to fetch note by ID ${noteId} from database`);
    }

    return data;
  } catch (error) {
    logger.error('Error fetching note by ID', error);
    throw new Error(`Failed to fetch note by ID ${noteId}`);
  }
}

// Re-export types for convenience
export type {
  TranscriptionOptions,
  NoteMetadata,
  AudioProcessingResult,
  TranscriptionResult,
  AudioWithNoteResult,
  FileValidationResult,
  AudioProcessingErrorDetails
};