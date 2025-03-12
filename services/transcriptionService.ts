import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to transcribe audio using Supabase function
export const transcribeAudio = async (audioFile: File): Promise<string> => {
  try {
    // Upload to Supabase storage and get transcription
    const { transcription } = await processAudioInSupabase(audioFile);
    return transcription;
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
};

// Helper function to process audio in Supabase
async function processAudioInSupabase(audioFile: File): Promise<{ transcription: string; summary: string; fileUrl: string }> {
  // Generate a unique filename
  const filename = `audio_${Date.now()}.${audioFile.name.split('.').pop()}`;
  const filePath = `temp_audio/${filename}`;

  // 1. Upload the file to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('audio_uploads')
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
    .from('audio_uploads')
    .getPublicUrl(filePath);

  // 3. Call the Supabase function with the file URL
  const { data, error } = await supabase.functions.invoke('summarize-audio', {
    body: { audioUrl: publicUrl }
  });

  if (error) {
    console.error('Supabase function error:', error);
    
    // Clean up the uploaded file
    await supabase.storage.from('audio_uploads').remove([filePath]);
    
    throw new Error('Failed to process audio with Supabase function');
  }

  // 4. Clean up the uploaded file (optional - you may want to keep it)
  await supabase.storage.from('audio_uploads').remove([filePath]);

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
    // Process the audio using Supabase
    const { transcription, summary } = await processAudioInSupabase(audioFile);
    
    // Save the note with transcription and summary
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: metadata.title,
        transcription,
        summary,
      })
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
