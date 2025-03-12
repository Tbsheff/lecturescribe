// ...existing code...

export interface Note {
  id: string;
  user_id: string;
  transcription: string;
  summary: string;
  created_at: string;
  [key: string]: any; // For additional metadata
}

// ...existing code...
