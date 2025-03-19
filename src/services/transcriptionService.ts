import { createClient } from '@supabase/supabase-js';
import { getNote, saveNote, NoteData, listNotes } from "./noteStorage";

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Consistent bucket name to use throughout the app
const AUDIO_BUCKET = 'audio_uploads';

// Function to transcribe audio using Supabase function
export const transcribeAudio = async (audioFile: File, userId: string): Promise<string> => {
  try {
    // Upload to Supabase storage and get transcription
    const { transcription } = await processAudioInSupabase(audioFile, userId);
    return transcription;
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
};

// Helper function to process audio in Supabase
async function processAudioInSupabase(audioFile: File, userId: string): Promise<{ transcription: string; summary: string; fileUrl: string }> {
  if (!userId) {
    console.error('processAudioInSupabase: Missing user ID');
    throw new Error('User ID is required to upload audio files');
  }
  
  // Generate a unique filename
  const timestamp = Date.now();
  const filename = `audio_${timestamp}.${audioFile.name.split('.').pop()}`;
  // Include userId in the path for better organization and security
  const filePath = `${userId}/temp_audio/${filename}`;
  
  console.log(`Uploading file for user ${userId}: ${filePath}`);
  
  // 1. Upload the file to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(filePath, audioFile, {
      contentType: audioFile.type,
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw new Error('Failed to upload audio file');
  }

  // 2. Get a public URL for the file
  const { data: { publicUrl } } = supabase.storage
    .from(AUDIO_BUCKET)
    .getPublicUrl(filePath);

  // 3. Call the Supabase function with the file URL
  const { data, error } = await supabase.functions.invoke('summarize-audio', {
    body: { 
      audioUrl: publicUrl,
      userId: userId // Pass userId to the function for additional context
    }
  });

  if (error) {
    console.error('Supabase function error:', error);
    
    // Clean up the uploaded file
    await supabase.storage.from(AUDIO_BUCKET).remove([filePath]);
    
    throw new Error('Failed to process audio with Supabase function');
  }

  // 4. Clean up the uploaded file (optional - you may want to keep it)
  await supabase.storage.from(AUDIO_BUCKET).remove([filePath]);

  return {
    transcription: data.transcription,
    summary: data.summary,
    fileUrl: publicUrl
  };
}

// Process audio to get both transcription and summary
export const processAudioWithSummary = async (
  audioFile: File,
  userId: string,
  metadata: any
): Promise<{ transcription: string; summary: string; noteId: string }> => {
  try {
    console.log('Processing audio with summary:', { userId, metadata });
    
    // Process the audio using Supabase - pass userId
    const { transcription, summary, fileUrl } = await processAudioInSupabase(audioFile, userId);
    
    // Create note data object for storage
    const noteData: NoteData = {
      title: metadata.title,
      transcription: transcription,
      summary: summary,
      audioUrl: fileUrl,
      folderId: metadata.folderId
    };
    
    // Save the note using noteStorage instead of directly to the database
    const noteId = await saveNote(userId, noteData);
    
    return {
      transcription,
      summary,
      noteId
    };
  } catch (error) {
    console.error('Processing error:', error);
    throw new Error('Failed to process audio');
  }
};

// Update the fetch notes function to use noteStorage's listNotes function
export const fetchNotes = async (userId: string) => {
  try {
    // Use the listNotes function from noteStorage
    const notesMetadata = await listNotes(userId);
    
    // Transform to the expected format
    return notesMetadata.map((note) => ({
      id: note.id,
      title: note.title || 'Untitled Note',
      date: new Date(note.created_at),
      preview: note.preview || 'No content available',
      folderId: note.folder_id
    }));
  } catch (error) {
    console.error('Error fetching notes:', error);
    throw new Error('Failed to fetch notes');
  }
};

// Function to fetch a single note by ID
export const fetchNoteById = async (noteId: string) => {
  try {
    const noteData = await getNote(noteId);

    if (!noteData) {
      throw new Error(`Failed to fetch note by ID ${noteId} from storage`);
    }

        return noteData;
  } catch (error) {
    console.error('Error fetching note by ID:', error);
    throw new Error(`Failed to fetch note by ID ${noteId}`);
  }
};
