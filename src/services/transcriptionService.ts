import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getNote } from './noteStorage';

// Error types for better error handling
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

// Types
export interface ProcessResult {
  transcription: string;
  summary: string;
  noteId: string;
}

export interface NoteData {
  id: string;
  title: string;
  date: Date;
  preview: string;
}

// Service Interface
export interface ITranscriptionService {
  transcribeAudio(audioFile: File): Promise<string>;
  processAudioWithSummary(
    audioFile: File,
    userId: string,
    metadata: any
  ): Promise<ProcessResult>;
  fetchNotes(): Promise<NoteData[]>;
  fetchNoteById(noteId: string): Promise<any>;
}

// Service Implementation with Dependency Injection
export class TranscriptionService implements ITranscriptionService {
  constructor(private supabase: SupabaseClient) {}

  // Function to transcribe audio using Supabase function (secure - no API keys in frontend)
  async transcribeAudio(audioFile: File): Promise<string> {
    try {
      const { transcription } = await this.processAudioInSupabase(audioFile);
      return transcription;
    } catch (error) {
      console.error('Transcription error:', error);
      // Re-throw the original error to preserve error messages for tests
      throw error;
    }
  }

  // Process audio to get both transcription and summary
  async processAudioWithSummary(
    audioFile: File,
    userId: string,
    metadata: any
  ): Promise<ProcessResult> {
    try {
      // Process the audio using Supabase
      const { transcription, summary, fileUrl } = await this.processAudioInSupabase(audioFile);

      // Save the note with transcription and summary
      const { data: noteData, error: noteError } = await this.supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: metadata.title,
          transcription,
          raw_summary: summary,
          audio_url: fileUrl
        })
        .select()
        .single();

      if (noteError) {
        console.error('Error saving note:', noteError);
        throw new Error('Failed to save note');
      }

      return {
        transcription,
        summary,
        noteId: noteData.id,
      };
    } catch (error) {
      console.error('Processing error:', error);
      // If it's already a known error type, re-throw it
      if (error instanceof ValidationError ||
          error instanceof UploadError ||
          error instanceof TranscriptionError ||
          (error instanceof Error && error.message.includes('Failed to save note'))) {
        throw error;
      }
      // Otherwise wrap it
      throw new Error('Failed to process audio');
    }
  }

  // Fetch notes function
  async fetchNotes(): Promise<NoteData[]> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((note: any) => ({
        id: note.id,
        title: note.title || 'Untitled Note',
        date: new Date(note.created_at),
        preview: note.raw_summary || note.content?.substring(0, 100) || 'No content available'
      }));
    } catch (error) {
      console.error('Error fetching notes:', error);
      throw new Error('Failed to fetch notes');
    }
  }

  // Function to fetch a single note by ID
  async fetchNoteById(noteId: string): Promise<any> {
    try {
      const noteData = await getNote(noteId);

      if (!noteData) {
        throw new Error(`Note with ID ${noteId} not found`);
      }

      return noteData;
    } catch (error) {
      console.error('Error fetching note by ID:', error);
      // Re-throw if it's already a specific error
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to fetch note by ID ${noteId}`);
    }
  }

  // Private helper method for processing audio
  private async processAudioInSupabase(audioFile: File): Promise<{
    transcription: string;
    summary: string;
    fileUrl: string
  }> {
    // Validate the audio file
    this.validateAudioFile(audioFile);

    // Check if file type is supported
    const contentType = this.determineContentType(audioFile);

    // Generate a unique filename
    const fileExtension = audioFile.name.split('.').pop()?.toLowerCase() || 'wav';
    const filename = `audio_${Date.now()}.${fileExtension}`;
    const filePath = `temp_audio/${filename}`;

    let publicUrl = '';

    try {
      // 1. Upload the file to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('audio_uploads')
        .upload(filePath, audioFile, {
          contentType: contentType,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new UploadError(`Failed to upload audio file: ${uploadError.message}`);
      }

      // 2. Get a public URL for the file
      const { data: urlData } = this.supabase.storage
        .from('audio_uploads')
        .getPublicUrl(filePath);

      publicUrl = urlData.publicUrl;

      // 3. Call the Supabase function with the file URL
      // Note: Provider selection is now handled on the backend based on environment config
      const { data, error } = await this.supabase.functions.invoke('summarize-audio', {
        body: {
          audioUrl: publicUrl,
          contentType: contentType,
          fileName: filename
          // No provider parameter - backend decides based on configuration
        }
      });

      if (error) {
        throw new TranscriptionError(`Failed to process audio: ${error.message}`);
      }

      if (!data || !data.transcription || data.transcription.trim().length === 0) {
        throw new TranscriptionError('No transcription received from processing service');
      }

      // 4. Clean up the uploaded file
      await this.cleanup(filePath);

      return {
        transcription: data.transcription,
        summary: data.summary || '',
        fileUrl: publicUrl
      };
    } catch (error) {
      // Clean up on error
      await this.cleanup(filePath);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Audio processing failed: ${errorMessage}`);
    }
  }

  // Validate audio file
  private validateAudioFile(audioFile: File): void {
    if (!audioFile || !audioFile.size) {
      throw new ValidationError('Invalid or empty audio file');
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      throw new ValidationError('File is too large. Maximum size is 100MB');
    }
  }

  // Determine content type from file
  private determineContentType(audioFile: File): string {
    const supportedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    let contentType = audioFile.type;

    // If type is not explicitly supported, try to determine from extension
    if (!supportedTypes.includes(contentType)) {
      const extension = audioFile.name.split('.').pop()?.toLowerCase() || '';
      switch (extension) {
        case 'wav':
        case 'wave':
          contentType = 'audio/wav';
          break;
        case 'mp3':
        case 'mpeg':
          contentType = 'audio/mpeg';
          break;
        case 'm4a':
          contentType = 'audio/x-m4a';
          break;
        case 'mp4':
          contentType = 'audio/mp4';
          break;
        case 'webm':
          contentType = 'audio/webm';
          break;
        default:
          throw new ValidationError(`Unsupported file type: ${extension}. Please use WAV, MP3, M4A, or WebM files.`);
      }
    }

    return contentType;
  }

  // Clean up temporary files
  private async cleanup(filePath: string): Promise<void> {
    try {
      await this.supabase.storage.from('audio_uploads').remove([filePath]);
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary file:', cleanupError);
    }
  }
}

// Factory function to create service with optional client
export function createTranscriptionService(client?: SupabaseClient): ITranscriptionService {
  const supabaseClient = client || createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
  );

  return new TranscriptionService(supabaseClient);
}

// Lazy-initialized default service for backward compatibility
let defaultService: ITranscriptionService | null = null;

const getDefaultService = (): ITranscriptionService => {
  if (!defaultService) {
    defaultService = createTranscriptionService();
  }
  return defaultService;
};

// Export individual functions for backward compatibility
export const transcribeAudio = (audioFile: File): Promise<string> =>
  getDefaultService().transcribeAudio(audioFile);

export const processAudioWithSummary = (
  audioFile: File,
  userId: string,
  metadata: any
): Promise<ProcessResult> =>
  getDefaultService().processAudioWithSummary(audioFile, userId, metadata);

export const fetchNotes = (): Promise<NoteData[]> =>
  getDefaultService().fetchNotes();

export const fetchNoteById = (noteId: string): Promise<any> =>
  getDefaultService().fetchNoteById(noteId);

// For default export, we need to export the service itself
// but only create it when actually used
export default new Proxy({} as ITranscriptionService, {
  get(target, prop) {
    const service = getDefaultService();
    return (service as any)[prop];
  }
});