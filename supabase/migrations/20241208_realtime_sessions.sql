-- Migration for real-time transcription sessions

-- Create realtime_sessions table
CREATE TABLE IF NOT EXISTS realtime_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration BIGINT DEFAULT 0, -- Duration in milliseconds
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'cancelled')) DEFAULT 'active',
    settings JSONB NOT NULL DEFAULT '{}',
    stats JSONB NOT NULL DEFAULT '{
        "wordsTranscribed": 0,
        "charactersTranscribed": 0,
        "chunksProcessed": 0,
        "averageConfidence": 0,
        "qualityScore": 0
    }',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create realtime_segments table
CREATE TABLE IF NOT EXISTS realtime_segments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES realtime_sessions(id) ON DELETE CASCADE,
    start_time BIGINT NOT NULL, -- Relative to session start in milliseconds
    end_time BIGINT NOT NULL,
    transcript TEXT NOT NULL,
    words JSONB NOT NULL DEFAULT '[]', -- Array of word objects with timing
    confidence REAL NOT NULL DEFAULT 0.0,
    is_final BOOLEAN NOT NULL DEFAULT false,
    speaker INTEGER, -- Speaker ID for diarization
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_user_id ON realtime_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_status ON realtime_sessions(status);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_created_at ON realtime_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_sessions_user_created ON realtime_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_segments_session_id ON realtime_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_realtime_segments_is_final ON realtime_segments(is_final);
CREATE INDEX IF NOT EXISTS idx_realtime_segments_start_time ON realtime_segments(session_id, start_time);
CREATE INDEX IF NOT EXISTS idx_realtime_segments_speaker ON realtime_segments(session_id, speaker) WHERE speaker IS NOT NULL;

-- Add RLS (Row Level Security) policies
ALTER TABLE realtime_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_segments ENABLE ROW LEVEL SECURITY;

-- Policies for realtime_sessions
CREATE POLICY "Users can view their own sessions" ON realtime_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON realtime_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON realtime_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON realtime_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for realtime_segments
CREATE POLICY "Users can view segments of their sessions" ON realtime_segments
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM realtime_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert segments to their sessions" ON realtime_segments
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT id FROM realtime_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update segments of their sessions" ON realtime_segments
    FOR UPDATE USING (
        session_id IN (
            SELECT id FROM realtime_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete segments of their sessions" ON realtime_segments
    FOR DELETE USING (
        session_id IN (
            SELECT id FROM realtime_sessions WHERE user_id = auth.uid()
        )
    );

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at on realtime_sessions
CREATE TRIGGER update_realtime_sessions_updated_at 
    BEFORE UPDATE ON realtime_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate session statistics
CREATE OR REPLACE FUNCTION calculate_session_stats(session_id TEXT)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    final_segments_count INTEGER;
    total_words INTEGER;
    total_characters INTEGER;
    total_chunks INTEGER;
    avg_confidence REAL;
    quality_score REAL;
BEGIN
    -- Count final segments
    SELECT COUNT(*) INTO final_segments_count
    FROM realtime_segments 
    WHERE session_id = calculate_session_stats.session_id AND is_final = true;
    
    -- Calculate word count
    SELECT COALESCE(SUM(jsonb_array_length(words)), 0) INTO total_words
    FROM realtime_segments 
    WHERE session_id = calculate_session_stats.session_id AND is_final = true;
    
    -- Calculate character count
    SELECT COALESCE(SUM(LENGTH(transcript)), 0) INTO total_characters
    FROM realtime_segments 
    WHERE session_id = calculate_session_stats.session_id AND is_final = true;
    
    -- Count total chunks
    SELECT COUNT(*) INTO total_chunks
    FROM realtime_segments 
    WHERE session_id = calculate_session_stats.session_id;
    
    -- Calculate average confidence
    SELECT COALESCE(AVG(confidence), 0) INTO avg_confidence
    FROM realtime_segments 
    WHERE session_id = calculate_session_stats.session_id AND is_final = true;
    
    -- Calculate quality score (simplified version)
    quality_score := CASE 
        WHEN avg_confidence > 0.8 THEN 1.0
        WHEN avg_confidence > 0.6 THEN 0.8
        WHEN avg_confidence > 0.4 THEN 0.6
        WHEN avg_confidence > 0.2 THEN 0.4
        ELSE 0.2
    END;
    
    -- Build stats JSON
    stats := jsonb_build_object(
        'wordsTranscribed', total_words,
        'charactersTranscribed', total_characters,
        'chunksProcessed', total_chunks,
        'averageConfidence', avg_confidence,
        'qualityScore', quality_score,
        'finalSegments', final_segments_count
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Create function to get session transcript
CREATE OR REPLACE FUNCTION get_session_transcript(session_id TEXT)
RETURNS TEXT AS $$
DECLARE
    transcript TEXT;
BEGIN
    SELECT string_agg(rs.transcript, ' ' ORDER BY rs.start_time) INTO transcript
    FROM realtime_segments rs
    WHERE rs.session_id = get_session_transcript.session_id 
    AND rs.is_final = true;
    
    RETURN COALESCE(transcript, '');
END;
$$ LANGUAGE plpgsql;

-- Create view for session summaries
CREATE OR REPLACE VIEW realtime_session_summaries AS
SELECT 
    rs.id,
    rs.user_id,
    rs.title,
    rs.start_time,
    rs.end_time,
    rs.duration,
    rs.status,
    rs.settings,
    rs.stats,
    rs.metadata,
    rs.created_at,
    rs.updated_at,
    get_session_transcript(rs.id) as full_transcript,
    (
        SELECT COUNT(*) 
        FROM realtime_segments seg 
        WHERE seg.session_id = rs.id AND seg.is_final = true
    ) as final_segments_count,
    (
        SELECT COUNT(*) 
        FROM realtime_segments seg 
        WHERE seg.session_id = rs.id
    ) as total_segments_count
FROM realtime_sessions rs;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON realtime_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON realtime_segments TO authenticated;
GRANT SELECT ON realtime_session_summaries TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_session_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_transcript(TEXT) TO authenticated;

-- Add comments
COMMENT ON TABLE realtime_sessions IS 'Real-time transcription sessions with metadata and statistics';
COMMENT ON TABLE realtime_segments IS 'Individual transcript segments with timing and confidence data';
COMMENT ON FUNCTION calculate_session_stats(TEXT) IS 'Calculate comprehensive statistics for a transcription session';
COMMENT ON FUNCTION get_session_transcript(TEXT) IS 'Get the full transcript text for a session';
COMMENT ON VIEW realtime_session_summaries IS 'Comprehensive view of sessions with calculated fields';