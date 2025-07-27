-- Create video_metadata table for storing YouTube and other video platform data
CREATE TABLE IF NOT EXISTS video_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes_new(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'vimeo', 'uploaded')),
  video_id TEXT NOT NULL,
  title TEXT,
  duration INTEGER, -- in seconds
  thumbnail_url TEXT,
  captions JSONB, -- Store caption data as JSON
  chapters JSONB, -- Store chapter markers as JSON
  metadata JSONB, -- Additional platform-specific metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one video metadata per note
  CONSTRAINT unique_note_video UNIQUE (note_id)
);

-- Add indexes for performance
CREATE INDEX idx_video_metadata_note_id ON video_metadata(note_id);
CREATE INDEX idx_video_metadata_platform ON video_metadata(platform);
CREATE INDEX idx_video_metadata_video_id ON video_metadata(video_id);

-- Add RLS policies
ALTER TABLE video_metadata ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own video metadata
CREATE POLICY "Users can view own video metadata"
  ON video_metadata
  FOR SELECT
  USING (
    note_id IN (
      SELECT id FROM notes_new WHERE user_id = auth.uid()
    )
  );

-- Policy for users to insert their own video metadata
CREATE POLICY "Users can insert own video metadata"
  ON video_metadata
  FOR INSERT
  WITH CHECK (
    note_id IN (
      SELECT id FROM notes_new WHERE user_id = auth.uid()
    )
  );

-- Policy for users to update their own video metadata
CREATE POLICY "Users can update own video metadata"
  ON video_metadata
  FOR UPDATE
  USING (
    note_id IN (
      SELECT id FROM notes_new WHERE user_id = auth.uid()
    )
  );

-- Policy for users to delete their own video metadata
CREATE POLICY "Users can delete own video metadata"
  ON video_metadata
  FOR DELETE
  USING (
    note_id IN (
      SELECT id FROM notes_new WHERE user_id = auth.uid()
    )
  );

-- Add video-specific columns to blocks table if not exists
ALTER TABLE blocks 
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_timestamp FLOAT,
ADD COLUMN IF NOT EXISTS video_platform TEXT;

-- Create updated_at trigger for video_metadata
CREATE OR REPLACE FUNCTION update_video_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_video_metadata_updated_at
  BEFORE UPDATE ON video_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_video_metadata_updated_at();