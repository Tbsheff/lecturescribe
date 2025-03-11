import { createClient } from '@supabase/supabase-js';

// Assuming you have environment variables set up for Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Transcribe audio file using your existing transcription function
 * @param audioFile - The audio file to transcribe
 * @returns The transcription text
 */
export async function transcribeAudio(audioFile: File): Promise<string> {
  // ...existing code...
  
  // Return the transcription text
  return transcriptionText;
}

/**
 * Process audio file to get both transcription and summary
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
    // Step 1: Get transcription
    const transcription = await transcribeAudio(audioFile);
    
    // Step 2: Get summary from Gemini API
    const summary = await getSummaryFromGemini(transcription);
    
    // Step 3: Save to database
    const noteId = await saveNoteToDatabase(transcription, summary, userId, metadata);
    
    return {
      transcription,
      summary,
      noteId
    };
  } catch (error) {
    console.error('Error processing audio:', error);
    throw error;
  }
}

/**
 * Get summary of transcription text using Gemini API
 */
async function getSummaryFromGemini(transcription: string): Promise<string> {
  try {
    const response = await fetch('/api/gemini-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcription }),
    });
    
    if (!response.ok) {
      throw new Error(`Error from Gemini API: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('Error getting summary from Gemini:', error);
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
