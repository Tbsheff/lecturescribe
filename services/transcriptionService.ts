import { createClient } from '@supabase/supabase-js';

// Assuming you have environment variables set up for Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Process audio file to get both transcription and summary using a single API call
 * @param audioFile - The audio file to process
 * @param userId - The user ID for database storage
 * @param metadata - Additional metadata for the note
 */
export async function processAudioWithSummary(
  audioFile: File, 
  userId: string,
  metadata: Record<string, any> = {}
): Promise<{ 
  transcription: string; 
  summary: string; 
  noteId: string;
}> {
  try {
    console.log('Processing audio file:', audioFile.name, audioFile.type, audioFile.size);
    
    // Step 1: Send audio to Gemini API to get both transcription and summary
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    console.log('Sending audio to Gemini API...');
    const response = await fetch('/api/gemini-audio-process', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Received API response:', data);
    
    if (!data.transcription || !data.summary) {
      throw new Error('API returned empty transcription or summary');
    }
    
    // Step 2: Save to database
    const noteId = await saveNoteToDatabase(data.transcription, data.summary, userId, metadata);
    
    return {
      transcription: data.transcription,
      summary: data.summary,
      noteId
    };
  } catch (error) {
    console.error('Error processing audio:', error);
    throw error;
  }
}

/**
 * Save note data to Supabase database
 */
async function saveNoteToDatabase(
  transcription: string, 
  summary: string, 
  userId: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert([
        { 
          user_id: userId,
          transcription,
          summary,
          created_at: new Date().toISOString(),
          ...metadata
        }
      ])
      .select();
    
    if (error) throw error;
    return data[0].id;
  } catch (error) {
    console.error('Error saving to database:', error);
    throw error;
  }
}
