-- Migration: Create block-based architecture for LectureScribe
-- This transforms the app from simple note storage to a sophisticated block-based system

-- 1. Create the core blocks table
CREATE TABLE blocks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id      UUID NOT NULL, -- Groups blocks into "notes" (lectures)
  parent_id    UUID NULL REFERENCES blocks(id) ON DELETE CASCADE,
  position     NUMERIC(10,4) NOT NULL,
  type         VARCHAR(50) NOT NULL,
  props        JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  
  -- LectureScribe-specific fields
  audio_timestamp NUMERIC NULL, -- Links to specific time in lecture audio
  ai_generated    BOOLEAN DEFAULT false, -- Track AI vs human content
  version         INTEGER DEFAULT 1, -- For conflict resolution
  
  CONSTRAINT blocks_position_positive CHECK (position > 0),
  CONSTRAINT blocks_valid_parent CHECK (id != parent_id)
);

-- 2. Create enhanced notes table (lecture containers)
CREATE TABLE notes_new (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id   UUID NULL REFERENCES folders(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  audio_url   TEXT NULL, -- Main lecture audio file
  duration    NUMERIC NULL, -- Audio duration in seconds
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  
  -- Metadata for quick access
  block_count INTEGER DEFAULT 0,
  last_edit_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT notes_title_length CHECK (length(title) <= 500)
);

-- 3. Add enhancements to existing folders table
ALTER TABLE folders ADD COLUMN IF NOT EXISTS color VARCHAR(7); -- Hex color
ALTER TABLE folders ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS sort_order VARCHAR(20) DEFAULT 'name'; -- name, date, custom

-- 4. Create performance indexes
-- Core indexes for blocks
CREATE INDEX idx_blocks_note_tree ON blocks(note_id, parent_id, position);
CREATE INDEX idx_blocks_user ON blocks(user_id);
CREATE INDEX idx_blocks_type ON blocks(type);
CREATE INDEX idx_blocks_updated ON blocks(updated_at DESC);

-- LectureScribe-specific indexes
CREATE INDEX idx_blocks_audio_timestamp ON blocks(audio_timestamp) 
WHERE audio_timestamp IS NOT NULL;

CREATE INDEX idx_blocks_ai_generated ON blocks(ai_generated) 
WHERE ai_generated = true;

-- JSONB indexes for props
CREATE INDEX idx_blocks_props_gin ON blocks USING gin(props);

-- Specific prop searches
CREATE INDEX idx_blocks_text_search ON blocks USING gin(
  to_tsvector('english', COALESCE(props->>'text', ''))
) WHERE props ? 'text';

-- Notes indexes
CREATE INDEX idx_notes_user_folder ON notes_new(user_id, folder_id);
CREATE INDEX idx_notes_updated ON notes_new(updated_at DESC);
CREATE INDEX idx_notes_title_search ON notes_new USING gin(to_tsvector('english', title));

-- 5. Create views for common queries
-- View for note with block count and latest activity
CREATE VIEW note_summaries AS
SELECT 
  n.*,
  COUNT(b.id) as block_count_calc,
  MAX(b.updated_at) as last_block_update,
  COALESCE(
    (SELECT props->>'text' FROM blocks WHERE note_id = n.id AND type = 'summary' LIMIT 1),
    LEFT((SELECT props->>'text' FROM blocks WHERE note_id = n.id AND props ? 'text' ORDER BY position LIMIT 1), 200)
  ) as preview
FROM notes_new n
LEFT JOIN blocks b ON b.note_id = n.id
GROUP BY n.id;

-- View for hierarchical block structure
CREATE VIEW block_tree AS
WITH RECURSIVE tree AS (
  -- Root blocks (no parent)
  SELECT 
    id, note_id, parent_id, type, props, position, 
    0 as depth,
    ARRAY[position::numeric] as path,
    position::text as sort_path
  FROM blocks 
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- Child blocks
  SELECT 
    b.id, b.note_id, b.parent_id, b.type, b.props, b.position,
    t.depth + 1,
    t.path || b.position::numeric,
    t.sort_path || '.' || b.position::text
  FROM blocks b
  JOIN tree t ON b.parent_id = t.id
)
SELECT * FROM tree ORDER BY note_id, sort_path;

-- 6. Set up Row Level Security
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes_new ENABLE ROW LEVEL SECURITY;

-- Blocks policies
CREATE POLICY "Users can access their own blocks"
  ON blocks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notes policies  
CREATE POLICY "Users can access their own notes"
  ON notes_new FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Create triggers and functions for maintenance
-- Update note's updated_at when blocks change
CREATE OR REPLACE FUNCTION update_note_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE notes_new 
    SET updated_at = now()
    WHERE id = OLD.note_id;
    RETURN OLD;
  ELSE
    UPDATE notes_new 
    SET updated_at = now(),
        last_edit_by = NEW.user_id
    WHERE id = NEW.note_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blocks_update_note_timestamp
  AFTER INSERT OR UPDATE OR DELETE ON blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_note_timestamp();

-- Maintain block count
CREATE OR REPLACE FUNCTION update_block_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE notes_new SET block_count = block_count - 1 WHERE id = OLD.note_id;
    RETURN OLD;
  ELSE
    UPDATE notes_new SET block_count = block_count + 1 WHERE id = NEW.note_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blocks_maintain_count
  AFTER INSERT OR DELETE ON blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_block_count();

-- 8. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE notes_new;

-- Add comments for documentation
COMMENT ON TABLE blocks IS 'Block-based content storage for LectureScribe - each block represents a piece of content like text, audio clip, summary, etc.';
COMMENT ON TABLE notes_new IS 'Enhanced notes table that serves as containers for blocks, representing complete lectures or documents';
COMMENT ON COLUMN blocks.audio_timestamp IS 'Links this block to a specific timestamp in the lecture audio';
COMMENT ON COLUMN blocks.ai_generated IS 'Indicates if this block was generated by AI (transcription, summary, etc.)';
COMMENT ON COLUMN blocks.props IS 'Flexible JSONB storage for block-specific properties based on block type';