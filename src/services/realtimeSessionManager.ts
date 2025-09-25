import { createClient } from '@supabase/supabase-js';
import { TranscriptionWord } from '@/hooks/useRealtimeTranscription';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export interface RealtimeSession {
  id: string;
  userId: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in milliseconds
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  settings: {
    model: string;
    language: string;
    diarize: boolean;
    punctuate: boolean;
    smart_format: boolean;
  };
  stats: {
    wordsTranscribed: number;
    charactersTranscribed: number;
    chunksProcessed: number;
    averageConfidence: number;
    qualityScore: number;
  };
  metadata: {
    connectionId?: string;
    userAgent?: string;
    provider: string;
    version: string;
  };
}

export interface SessionSegment {
  id: string;
  sessionId: string;
  startTime: number; // relative to session start
  endTime: number;
  transcript: string;
  words: TranscriptionWord[];
  confidence: number;
  isFinal: boolean;
  speaker?: number;
  timestamp: Date;
}

export class RealtimeSessionManager {
  private currentSession: RealtimeSession | null = null;
  private segments: SessionSegment[] = [];
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private readonly AUTOSAVE_INTERVAL = 10000; // 10 seconds

  async createSession(
    userId: string,
    title: string,
    settings: RealtimeSession['settings']
  ): Promise<RealtimeSession> {
    const session: RealtimeSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      title: title || `Session ${new Date().toLocaleString()}`,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      settings,
      stats: {
        wordsTranscribed: 0,
        charactersTranscribed: 0,
        chunksProcessed: 0,
        averageConfidence: 0,
        qualityScore: 0,
      },
      metadata: {
        userAgent: navigator.userAgent,
        provider: 'deepgram',
        version: '1.0.0'
      }
    };

    try {
      // Save session to database
      const { error } = await supabase
        .from('realtime_sessions')
        .insert({
          id: session.id,
          user_id: session.userId,
          title: session.title,
          start_time: session.startTime.toISOString(),
          status: session.status,
          settings: session.settings,
          stats: session.stats,
          metadata: session.metadata,
        });

      if (error) {
        console.error('Failed to save session to database:', error);
        // Continue with local session even if DB save fails
      }

      this.currentSession = session;
      this.startAutoSave();
      
      console.log('Created realtime session:', session.id);
      return session;

    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error('Failed to create transcription session');
    }
  }

  async addSegment(
    transcript: string,
    words: TranscriptionWord[],
    confidence: number,
    isFinal: boolean,
    speaker?: number
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const now = Date.now();
    const sessionStart = this.currentSession.startTime.getTime();
    const relativeTime = now - sessionStart;

    const segment: SessionSegment = {
      id: `segment_${Date.now()}_${this.segments.length}`,
      sessionId: this.currentSession.id,
      startTime: relativeTime,
      endTime: relativeTime + (words[words.length - 1]?.end || 0),
      transcript,
      words,
      confidence,
      isFinal,
      speaker,
      timestamp: new Date()
    };

    // Add segment to local array
    this.segments.push(segment);

    // Update session stats
    this.currentSession.stats.wordsTranscribed += words.length;
    this.currentSession.stats.charactersTranscribed += transcript.length;
    this.currentSession.stats.chunksProcessed++;
    
    // Update average confidence
    const totalSegments = this.segments.filter(s => s.isFinal).length;
    if (totalSegments > 0) {
      const totalConfidence = this.segments
        .filter(s => s.isFinal)
        .reduce((sum, s) => sum + s.confidence, 0);
      this.currentSession.stats.averageConfidence = totalConfidence / totalSegments;
    }

    // Calculate quality score based on confidence and word count
    this.currentSession.stats.qualityScore = this.calculateQualityScore();

    // Update session duration
    this.currentSession.duration = relativeTime;

    try {
      // Save segment to database (only final segments to reduce noise)
      if (isFinal) {
        const { error } = await supabase
          .from('realtime_segments')
          .insert({
            id: segment.id,
            session_id: segment.sessionId,
            start_time: segment.startTime,
            end_time: segment.endTime,
            transcript: segment.transcript,
            words: segment.words,
            confidence: segment.confidence,
            is_final: segment.isFinal,
            speaker: segment.speaker,
            timestamp: segment.timestamp.toISOString(),
          });

        if (error) {
          console.error('Failed to save segment to database:', error);
        }
      }
    } catch (error) {
      console.error('Error saving segment:', error);
    }
  }

  async pauseSession(): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'active') {
      return;
    }

    this.currentSession.status = 'paused';
    await this.updateSession();
  }

  async resumeSession(): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'paused') {
      return;
    }

    this.currentSession.status = 'active';
    await this.updateSession();
  }

  async completeSession(): Promise<RealtimeSession> {
    if (!this.currentSession) {
      throw new Error('No active session to complete');
    }

    this.currentSession.status = 'completed';
    this.currentSession.endTime = new Date();
    this.currentSession.duration = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();

    await this.updateSession();
    this.stopAutoSave();

    const completedSession = { ...this.currentSession };
    this.currentSession = null;
    this.segments = [];

    console.log('Completed session:', completedSession.id);
    return completedSession;
  }

  async cancelSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.status = 'cancelled';
    this.currentSession.endTime = new Date();
    
    await this.updateSession();
    this.stopAutoSave();

    console.log('Cancelled session:', this.currentSession.id);
    this.currentSession = null;
    this.segments = [];
  }

  getFullTranscript(): string {
    return this.segments
      .filter(segment => segment.isFinal)
      .map(segment => segment.transcript)
      .join(' ')
      .trim();
  }

  getCurrentSession(): RealtimeSession | null {
    return this.currentSession;
  }

  getSegments(): SessionSegment[] {
    return [...this.segments];
  }

  getFinalSegments(): SessionSegment[] {
    return this.segments.filter(segment => segment.isFinal);
  }

  getInterimSegments(): SessionSegment[] {
    return this.segments.filter(segment => !segment.isFinal);
  }

  async getSessionHistory(userId: string, limit: number = 20): Promise<RealtimeSession[]> {
    try {
      const { data, error } = await supabase
        .from('realtime_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch session history:', error);
        return [];
      }

      return data.map(row => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        startTime: new Date(row.start_time),
        endTime: row.end_time ? new Date(row.end_time) : undefined,
        duration: row.duration || 0,
        status: row.status,
        settings: row.settings || {},
        stats: row.stats || {},
        metadata: row.metadata || {},
      }));
    } catch (error) {
      console.error('Error fetching session history:', error);
      return [];
    }
  }

  async getSessionDetails(sessionId: string): Promise<{
    session: RealtimeSession;
    segments: SessionSegment[];
  } | null> {
    try {
      const [sessionResult, segmentsResult] = await Promise.all([
        supabase
          .from('realtime_sessions')
          .select('*')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('realtime_segments')
          .select('*')
          .eq('session_id', sessionId)
          .order('start_time', { ascending: true })
      ]);

      if (sessionResult.error || !sessionResult.data) {
        console.error('Failed to fetch session:', sessionResult.error);
        return null;
      }

      const session: RealtimeSession = {
        id: sessionResult.data.id,
        userId: sessionResult.data.user_id,
        title: sessionResult.data.title,
        startTime: new Date(sessionResult.data.start_time),
        endTime: sessionResult.data.end_time ? new Date(sessionResult.data.end_time) : undefined,
        duration: sessionResult.data.duration || 0,
        status: sessionResult.data.status,
        settings: sessionResult.data.settings || {},
        stats: sessionResult.data.stats || {},
        metadata: sessionResult.data.metadata || {},
      };

      const segments: SessionSegment[] = (segmentsResult.data || []).map(row => ({
        id: row.id,
        sessionId: row.session_id,
        startTime: row.start_time,
        endTime: row.end_time,
        transcript: row.transcript,
        words: row.words || [],
        confidence: row.confidence,
        isFinal: row.is_final,
        speaker: row.speaker,
        timestamp: new Date(row.timestamp),
      }));

      return { session, segments };
    } catch (error) {
      console.error('Error fetching session details:', error);
      return null;
    }
  }

  private calculateQualityScore(): number {
    if (this.segments.length === 0) return 0;

    const finalSegments = this.getFinalSegments();
    if (finalSegments.length === 0) return 0;

    // Calculate quality based on multiple factors
    const avgConfidence = finalSegments.reduce((sum, s) => sum + s.confidence, 0) / finalSegments.length;
    const wordsPerSegment = finalSegments.reduce((sum, s) => sum + s.words.length, 0) / finalSegments.length;
    const segmentConsistency = finalSegments.filter(s => s.confidence > 0.7).length / finalSegments.length;

    // Weighted quality score (0-1)
    const qualityScore = (
      avgConfidence * 0.4 +
      Math.min(wordsPerSegment / 10, 1) * 0.3 +
      segmentConsistency * 0.3
    );

    return Math.round(qualityScore * 100) / 100;
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      await this.updateSession();
    }, this.AUTOSAVE_INTERVAL);
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  private async updateSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const { error } = await supabase
        .from('realtime_sessions')
        .update({
          end_time: this.currentSession.endTime?.toISOString(),
          duration: this.currentSession.duration,
          status: this.currentSession.status,
          stats: this.currentSession.stats,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.currentSession.id);

      if (error) {
        console.error('Failed to update session in database:', error);
      }
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }
}

// Export singleton instance
export const realtimeSessionManager = new RealtimeSessionManager();