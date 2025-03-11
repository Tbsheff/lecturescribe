import { createClient } from '@supabase/supabase-js';

// Assuming you have environment variables set up for Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fixed transcription text for testing
const TEST_TRANSCRIPTION = `
This is a sample lecture on modern computing architecture.
The lecture covers the following topics:
1. Introduction to CPU architecture and memory management
2. How software interfaces with hardware components
3. Optimization techniques for efficient computing
4. Future trends in computing architecture

In the first section, we discussed the evolution of CPU design from single-core to multi-core processors.
Memory management has evolved from simple paging to complex virtual memory systems.

The second section covered how modern operating systems provide abstraction layers between applications and hardware.
System calls, device drivers, and kernel interfaces were explained in detail.

For optimization, we discussed various algorithms including branch prediction, speculative execution, and cache optimization techniques.

Finally, we looked at emerging trends like quantum computing, neuromorphic computing, and specialized AI processors.
`;

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
    // Step 1: Send audio to Gemini API to get both transcription and summary
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    const response = await fetch('/api/gemini-audio-process', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const { transcription, summary } = data;
    
    // Step 2: Save to database
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
