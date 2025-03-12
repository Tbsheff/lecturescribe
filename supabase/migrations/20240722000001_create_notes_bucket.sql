-- Create a new bucket for storing notes and related files
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes', 'notes', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the notes bucket
CREATE POLICY "Users can read their own notes"
ON storage.objects FOR SELECT
USING (bucket_id = 'notes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their own notes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'notes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own notes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'notes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own notes"
ON storage.objects FOR DELETE
USING (bucket_id = 'notes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create a table to store note metadata for quick listing
CREATE TABLE IF NOT EXISTS public.note_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  audio_path TEXT,
  note_path TEXT NOT NULL,
  preview TEXT
);

-- Set up RLS for note_metadata
ALTER TABLE public.note_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own note metadata"
ON public.note_metadata FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own note metadata"
ON public.note_metadata FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own note metadata"
ON public.note_metadata FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own note metadata"
ON public.note_metadata FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for note_metadata
alter publication supabase_realtime add table note_metadata;