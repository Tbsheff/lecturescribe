import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key are not defined in environment variables.");
}

const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);

// Process audio to get both transcription and summary
export const processAudioWithSummary = async (
  audioFile: File,
  userId: string,
  metadata: any
): Promise<{ transcription: string; summary: string; noteId: string }> => {
  try {
    console.log('Processing audio with summary:', { userId, metadata });
    
    // Process the audio using Supabase
    const { transcription, summary, fileUrl } = await processAudioInSupabase(audioFile);
    
    // Save the note with transcription and summary
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: metadata.title,
        content: transcription,
        raw_summary: summary,
        audio_url: fileUrl,
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
    throw new Error('Failed to process audio');
  }
};

// Fixed to match how it's used in AudioUploader
export const transcribeAudio = async (audioFile: File): Promise<{ text: string }> => {
  console.log('transcribeAudio: Start');
  try {
    // Upload to Supabase storage and get transcription
    const { transcription } = await processAudioInSupabase(audioFile);
    return { text: transcription };
  } catch (error) {
    console.error('transcribeAudio: Error -', error);
    throw new Error('Failed to transcribe audio');
  } finally {
    console.log('transcribeAudio: Finally');
  }
};

// Function to summarize text transcription
export const summarizeTranscription = async (text: string) => {
  console.log('summarizeTranscription: Start');
  try {
    // Call the Supabase function with the text
    const { data, error } = await supabase.functions.invoke('summarize-audio', {
      body: { audioText: text }
    });

    if (error) {
      console.error('summarizeTranscription: Supabase Function error -', error);
      throw new Error('Failed to summarize transcription');
    }

    return {
      transcription: text,
      summary: data.summary
    };
  } catch (error) {
    console.error('summarizeTranscription: Error -', error);
    throw new Error('Failed to summarize transcription');
  } finally {
    console.log('summarizeTranscription: Finally');
  }
};

// Helper function to process audio in Supabase
export async function processAudioInSupabase(audioFile: File): Promise<{ transcription: string; summary: string; fileUrl: string }> {
  console.log('processAudioInSupabase: Start');
  // Validate the audio file
  if (!audioFile || !audioFile.size) {
    console.error('processAudioInSupabase: Invalid audio file');
    throw new Error('Invalid or empty audio file');
  }

  console.log('Processing audio file:', {
    name: audioFile.name,
    type: audioFile.type,
    size: audioFile.size,
    lastModified: new Date(audioFile.lastModified).toISOString()
  });

  // Check if file type is supported
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
        throw new Error(`Unsupported file type: ${extension}. Please use WAV, MP3, M4A, or WebM files.`);
    }
    console.log(`Determined content type ${contentType} based on extension ${extension}`);
  }

  // Generate a unique filename with original extension
  const fileExtension = audioFile.name.split('.').pop()?.toLowerCase() || 'wav';
  const filename = `audio_${Date.now()}.${fileExtension}`;
  const filePath = `temp_audio/${filename}`;

  console.log(`Uploading file to Supabase storage: ${filePath} (${contentType})`);

  let publicUrl = ''; // Declare publicUrl here

  try {
    // 1. Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio_uploads')
      .upload(filePath, audioFile, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('processAudioInSupabase: Storage Upload Error -', uploadError);
      throw new Error(`Failed to upload audio file: ${uploadError.message}`);
    }

    console.log('File uploaded successfully:', uploadData);

    // 2. Get a public URL for the file
    const { data: urlData } = supabase.storage
      .from('audio_uploads')
      .getPublicUrl(filePath);

    publicUrl = urlData.publicUrl; // Assign value to the declared publicUrl
    console.log('Generated public URL:', publicUrl);

    // Verify the uploaded file is accessible
    try {
      const response = await fetch(publicUrl, { method: 'HEAD' });
      if (!response.ok) {
        console.error('processAudioInSupabase: File Verification Error - HTTP Status', response.status);
        throw new Error(`Failed to verify uploaded file: HTTP ${response.status}`);
      }
      console.log('Verified uploaded file is accessible:', {
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
    } catch (verifyError) {
      console.error('processAudioInSupabase: File Verification Fetch Error -', verifyError);
      // Continue anyway, as the file might still be processable
    }

    // 3. Call the Supabase function with the file URL and metadata
    console.log('Calling Supabase function for audio processing');
    const { data, error } = await supabase.functions.invoke('summarize-audio', {
      body: {
        audioUrl: publicUrl,
        contentType: contentType,
        fileName: filename
      }
    });

    if (error) {
      console.error('processAudioInSupabase: Supabase Function Invoke Error -', error);
      throw new Error(`Failed to process audio: ${error.message}`);
    }

    if (!data || !data.transcription || data.transcription.trim().length === 0) {
      console.error('processAudioInSupabase: No transcription in response');
      throw new Error('No transcription received from processing service');
    }

    console.log('Audio processing successful:', {
      transcriptionLength: data.transcription.length,
      summaryLength: data.summary?.length || 0
    });

    // 4. Clean up the uploaded file
    try {
      await supabase.storage.from('audio_uploads').remove([filePath]);
      console.log('Temporary audio file removed from storage');
    } catch (cleanupError) {
      console.warn('processAudioInSupabase: File Cleanup Error -', cleanupError);
      // Don't throw on cleanup errors
    }

    return {
      transcription: data.transcription,
      summary: data.summary || '',
      fileUrl: publicUrl
    };
  } catch (error) {
    console.error('processAudioInSupabase: General Error -', error);
    // Clean up on error
    try {
      await supabase.storage.from('audio_uploads').remove([filePath]);
    } catch (cleanupError) {
      console.warn('processAudioInSupabase: Cleanup After Error -', cleanupError);
    }

    // Enhance error message for user-friendly display
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Audio processing failed: ${errorMessage}`);
  } finally {
    console.log('processAudioInSupabase: Finally');
  }
}


// Update the fetch notes function to handle navigation
export const fetchNotes = async () => {
  try {
    const { data, error } = await supabase
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
};


// Function to fetch a single note by ID
export const fetchNoteById = async (noteId: string) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (error) {
      console.error('Supabase fetch note by ID error:', error);
      throw new Error(`Failed to fetch note by ID ${noteId} from database`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching note by ID:', error);
    throw new Error(`Failed to fetch note by ID ${noteId}`);
  }
};
