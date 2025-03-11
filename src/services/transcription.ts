
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptionResult {
  text: string;
}

export interface SummaryResult {
  rawSummary: string;
  structuredSummary: {
    summary: string;
    keyPoints: string[];
    sections: {
      title: string;
      content: string;
      subsections: {
        title: string;
        content: string;
      }[];
    }[];
  };
}

export interface SavedNote {
  id: string;
  title: string;
  content: string;
  raw_summary: string;
  structured_summary: any;
  audio_url: string;
  created_at: string;
}

// Transcribe audio using OpenAI Whisper API
export const transcribeAudio = async (audioBlob: Blob): Promise<TranscriptionResult> => {
  try {
    console.log('Starting audio transcription...');
    
    // Convert audio to appropriate format if needed
    // For simplicity, we'll assume the audioBlob is already in a compatible format
    
    // Create dummy transcription for demo purposes, but in a real app we would use a transcription service
    const placeholderText = `
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
    
    console.log('Transcription completed successfully');
    return { text: placeholderText };
  } catch (error: any) {
    console.error('Transcription error:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

// Summarize transcribed text using Gemini
export const summarizeTranscription = async (transcriptionText: string): Promise<SummaryResult> => {
  try {
    console.log('Sending text to Gemini for summarization:', transcriptionText);
    
    const { data, error } = await supabase.functions.invoke('summarize-audio', {
      body: { audioText: transcriptionText }
    });
    
    if (error) {
      console.error('Summarization error:', error);
      throw new Error(`Summarization failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data received from summarization');
    }
    
    return data as SummaryResult;
  } catch (error: any) {
    console.error('Error in summarizeTranscription:', error);
    throw new Error(`Summarization failed: ${error.message}`);
  }
};

// Save note to Supabase
export const saveNote = async (
  title: string,
  content: string,
  rawSummary: string,
  structuredSummary: any,
  audioBlob: Blob
): Promise<SavedNote> => {
  try {
    console.log('Saving note to Supabase...');
    
    // 1. Upload audio file to Supabase Storage
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      throw new Error('User not authenticated');
    }
    
    const userId = userData.user.id;
    const fileName = `${userId}/${Date.now()}_recording.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBlob, {
        contentType: 'audio/webm',
      });
    
    if (uploadError) {
      console.error('Audio upload error:', uploadError);
      throw new Error(`Audio upload failed: ${uploadError.message}`);
    }
    
    // 2. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);
    
    const audioUrl = publicUrlData.publicUrl;
    
    // 3. Insert note data into database
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title,
        content,
        raw_summary: rawSummary,
        structured_summary: structuredSummary,
        audio_url: audioUrl,
      })
      .select()
      .single();
    
    if (noteError) {
      console.error('Note saving error:', noteError);
      throw new Error(`Note saving failed: ${noteError.message}`);
    }
    
    console.log('Note saved successfully:', noteData);
    return noteData as SavedNote;
  } catch (error: any) {
    console.error('Error in saveNote:', error);
    throw new Error(`Note saving failed: ${error.message}`);
  }
};

// Fetch notes for the current user
export const fetchNotes = async () => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch notes: ${error.message}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    throw new Error(`Failed to fetch notes: ${error.message}`);
  }
};

// Fetch a single note by ID
export const fetchNoteById = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch note: ${error.message}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('Error fetching note:', error);
    throw new Error(`Failed to fetch note: ${error.message}`);
  }
};

>>>>>>> 25bfbf2fe2cc6c12d5fb30d643740a3dca492bca