import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// Fixed to match how it's used in AudioUploader
export const transcribeAudio = async (audioFile: File): Promise<{ text: string }> => {
  try {
    // Upload to Supabase storage and get transcription
    const { transcription } = await processAudioInSupabase(audioFile);
    return { text: transcription };
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
};

// Function to summarize text transcription
export const summarizeTranscription = async (text: string) => {
  try {
    // Call the Supabase function with the text
    const { data, error } = await supabase.functions.invoke('summarize-audio', {
      body: { audioText: text }
    });
    
    if (error) {
      console.error('Summarization error:', error);
      throw new Error('Failed to summarize transcription');
    }
    
    return {
      transcription: text,
      summary: data.summary
    };
  } catch (error) {
    console.error('Summarization error:', error);
    throw new Error('Failed to summarize transcription');
  }
};

// Helper function to process audio in Supabase
export async function processAudioInSupabase(audioFile: File): Promise<{ transcription: string; summary: string; fileUrl: string }> {
  // Validate the audio file
  if (!audioFile || !audioFile.size) {
    console.error('Invalid audio file:', audioFile);
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
    if (extension === 'wav' || extension === 'wave') contentType = 'audio/wav';
    else if (extension === 'mp3') contentType = 'audio/mpeg';
    else if (extension === 'm4a') contentType = 'audio/x-m4a';
    else if (extension === 'mp4') contentType = 'audio/mp4';
    else if (extension === 'webm') contentType = 'audio/webm';
    else contentType = 'audio/wav'; // Default to WAV if unknown
    
    console.log(`File MIME type ${audioFile.type} not explicitly supported, using ${contentType} based on extension`);
  }

  // Generate a unique filename
  const fileExtension = audioFile.name.split('.').pop()?.toLowerCase() || 'wav';
  const filename = `audio_${Date.now()}.${fileExtension}`;
  const filePath = `temp_audio/${filename}`;
  
  console.log(`Uploading file to Supabase storage: ${filePath} (${contentType})`);
  
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
      console.error('Error uploading file to Supabase storage:', uploadError);
      throw new Error(`Failed to upload audio file: ${uploadError.message}`);
    }

    console.log('File uploaded successfully:', uploadData);

    // 2. Get a public URL for the file
    const { data: { publicUrl } } = supabase.storage
      .from('audio_uploads')
      .getPublicUrl(filePath);

    console.log('Generated public URL:', publicUrl);

    // 3. Call the Supabase function with the file URL
    console.log('Calling Supabase function with audio URL');
    const response = await fetch(publicUrl, { method: 'HEAD' });
    console.log('Audio file HEAD check:', { 
      status: response.status, 
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });

    const { data, error } = await supabase.functions.invoke('summarize-audio', {
      body: { 
        audioUrl: publicUrl,
        contentType: contentType, // Pass the content type explicitly
        fileName: filename // Pass the filename for reference
      }
    });

    if (error) {
      console.error('Supabase function error:', error);
      // Clean up the uploaded file
      await supabase.storage.from('audio_uploads').remove([filePath]);
      throw new Error(`Failed to process audio with Supabase function: ${error.message}`);
    }

    console.log('Audio processing successful, received response:', {
      transcriptionLength: data?.transcription?.length || 0,
      summaryLength: data?.summary?.length || 0
    });

    // 4. Clean up the uploaded file
    try {
      await supabase.storage.from('audio_uploads').remove([filePath]);
      console.log('Temporary audio file removed from storage');
    } catch (cleanupError) {
      console.warn('Could not clean up temporary file, will expire automatically:', cleanupError);
    }

    // Validate the response
    if (!data || !data.transcription) {
      throw new Error('Invalid response from audio processing service');
    }

    return {
      transcription: data.transcription || '',
      summary: data.summary || '',
      fileUrl: publicUrl
    };
  } catch (error) {
    console.error('Error during audio processing:', error);
    // Make sure to clean up even if there was an error
    await supabase.storage.from('audio_uploads').remove([filePath]).catch(e => {
      console.error('Error cleaning up file after processing error:', e);
    });
    throw error;
  }
}