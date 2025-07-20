-- Fix storage RLS policies to allow INSERT/UPDATE operations
-- The existing INSERT policy has no WITH CHECK clause

-- Fix storage objects policies for notes bucket
DROP POLICY IF EXISTS "Users can upload their own notes" ON storage.objects;
CREATE POLICY "Users can upload their own notes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'notes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Ensure UPDATE policy has WITH CHECK clause
DROP POLICY IF EXISTS "Users can update their own notes" ON storage.objects;
CREATE POLICY "Users can update their own notes"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'notes' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'notes' AND (storage.foldername(name))[1] = auth.uid()::text);