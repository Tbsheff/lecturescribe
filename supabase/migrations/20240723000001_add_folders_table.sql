-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES folders(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add folder_id to note_metadata table
ALTER TABLE note_metadata ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON folders(user_id);
CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON folders(parent_id);
CREATE INDEX IF NOT EXISTS note_metadata_folder_id_idx ON note_metadata(folder_id);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can only access their own folders" ON folders;
CREATE POLICY "Users can only access their own folders"
  ON folders
  USING (auth.uid() = user_id);

-- Update note_metadata policies to include folder_id
DROP POLICY IF EXISTS "Users can only access their own note metadata" ON note_metadata;
CREATE POLICY "Users can only access their own note metadata"
  ON note_metadata
  USING (auth.uid() = user_id);
