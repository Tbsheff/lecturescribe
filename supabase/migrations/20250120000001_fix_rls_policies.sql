-- Fix RLS policies to allow INSERT/UPDATE operations
-- The existing policies only have USING clauses but need WITH CHECK clauses for write operations

-- Fix folders table policy
DROP POLICY IF EXISTS "Users can only access their own folders" ON folders;
CREATE POLICY "Users can only access their own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix note_metadata table policy  
DROP POLICY IF EXISTS "Users can only access their own note metadata" ON note_metadata;
CREATE POLICY "Users can only access their own note metadata"
  ON note_metadata FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);