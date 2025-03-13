-- Add audio_bucket_path column to note_metadata table
ALTER TABLE note_metadata ADD COLUMN IF NOT EXISTS audio_bucket_path TEXT;

-- Create a function to update audio_bucket_path from audio_path
CREATE OR REPLACE FUNCTION update_audio_bucket_paths()
RETURNS void AS $$
BEGIN
  UPDATE note_metadata
  SET audio_bucket_path = audio_path
  WHERE audio_path IS NOT NULL AND audio_bucket_path IS NULL;
  
  RAISE NOTICE 'Updated audio bucket paths for note metadata';
END;
$$ LANGUAGE plpgsql;

-- Run the function to update existing records
SELECT update_audio_bucket_paths();
