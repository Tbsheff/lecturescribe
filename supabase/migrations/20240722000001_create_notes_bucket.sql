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

-- IMPORTANT: Manually add the following policy to the 'storage.buckets' table in the Supabase dashboard.
-- Go to: Authentication -> Policies -> New Policy (on storage.buckets) -> Use a template -> Enable read access to all authenticated users
-- Then, change the target roles to 'authenticated' only, and modify the USING expression to: (id = 'notes')
-- The final SQL should look like this:
-- CREATE POLICY "Allow read access to 'notes' bucket for authenticated users"
-- ON storage.buckets FOR SELECT
-- TO authenticated
-- USING (id = 'notes');

-- VERIFY: Double-check that the bucket name 'notes' used here matches the actual bucket name in your Supabase project.
