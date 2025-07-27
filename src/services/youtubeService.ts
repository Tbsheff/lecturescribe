/**
 * YouTube Service - Extract video data, metadata, and captions
 */

import { supabase } from "@/integrations/supabase/client";

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  duration: number; // in seconds
  thumbnail: string;
  channelName: string;
  publishedAt: string;
  viewCount: number;
  embedUrl: string;
  hasCaption: boolean;
}

export interface YouTubeCaption {
  text: string;
  start: number; // timestamp in seconds
  duration: number;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Validate if a URL is a YouTube video URL
 */
export const isYouTubeUrl = (url: string): boolean => {
  return extractVideoId(url) !== null;
};

/**
 * Get video metadata using YouTube oEmbed API (no API key required)
 */
export const getVideoMetadata = async (videoId: string): Promise<YouTubeVideoInfo> => {
  try {
    // Use oEmbed API for basic info (no API key needed)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedResponse = await fetch(oembedUrl);
    
    if (!oembedResponse.ok) {
      throw new Error("Video not found or is private");
    }

    const oembedData = await oembedResponse.json();

    // Use noembed.com as a fallback for additional data
    const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const noembedResponse = await fetch(noembedUrl);
    const noembedData = await noembedResponse.json();

    // Extract duration from thumbnail URL pattern or use default
    const duration = extractDurationFromData(noembedData) || 0;

    return {
      videoId,
      title: oembedData.title || "Untitled Video",
      description: noembedData.description || "",
      duration,
      thumbnail: oembedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      channelName: oembedData.author_name || "Unknown Channel",
      publishedAt: new Date().toISOString(), // oEmbed doesn't provide this
      viewCount: 0, // oEmbed doesn't provide this
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      hasCaption: false, // Will be determined separately
    };
  } catch (error) {
    console.error("Error fetching video metadata:", error);
    throw new Error("Failed to fetch video metadata");
  }
};

/**
 * Extract duration from various data sources
 */
const extractDurationFromData = (data: any): number => {
  // Try to parse duration from various possible fields
  if (data.duration) {
    return parseInt(data.duration);
  }
  
  // Default fallback
  return 600; // 10 minutes as default
};

/**
 * Get video captions/subtitles
 * Note: This is a placeholder - actual implementation would require
 * either YouTube API key or server-side caption extraction
 */
export const getVideoCaptions = async (videoId: string): Promise<YouTubeCaption[]> => {
  try {
    // For now, we'll call an edge function to handle caption extraction
    const { data, error } = await supabase.functions.invoke("youtube-captions", {
      body: { videoId },
    });

    if (error) {
      console.error("Error fetching captions:", error);
      return [];
    }

    return data.captions || [];
  } catch (error) {
    console.error("Error in getVideoCaptions:", error);
    return [];
  }
};

/**
 * Format duration from seconds to readable format
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Create a note from YouTube video
 */
export const createNoteFromYouTube = async (
  userId: string,
  videoUrl: string,
  folderId?: string | null
): Promise<string> => {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // Get video metadata
    const videoInfo = await getVideoMetadata(videoId);

    // Create note with video metadata
    const { data: noteData, error: noteError } = await supabase
      .from("notes_new")
      .insert({
        user_id: userId,
        title: videoInfo.title,
        folder_id: folderId || null,
        audio_url: null, // Will be set after processing
        duration: videoInfo.duration,
        block_count: 0,
      })
      .select("id")
      .single();

    if (noteError) throw noteError;

    const noteId = noteData.id;

    // Store video metadata
    const { error: metaError } = await supabase
      .from("video_metadata")
      .insert({
        note_id: noteId,
        platform: "youtube",
        video_id: videoId,
        title: videoInfo.title,
        duration: videoInfo.duration,
        thumbnail_url: videoInfo.thumbnail,
        captions: null, // Will be updated after processing
        chapters: null,
      });

    if (metaError) {
      console.error("Error storing video metadata:", metaError);
    }

    // Also create in old table for compatibility
    await supabase
      .from("note_metadata")
      .insert({
        id: noteId,
        user_id: userId,
        title: videoInfo.title,
        folder_id: folderId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // Trigger video processing in the background
    supabase.functions.invoke("process-youtube-video", {
      body: { noteId, videoId, userId },
    });

    return noteId;
  } catch (error) {
    console.error("Error creating note from YouTube:", error);
    throw error;
  }
};

/**
 * Check if video processing is complete
 */
export const checkVideoProcessingStatus = async (
  noteId: string
): Promise<{
  isProcessing: boolean;
  hasTranscript: boolean;
  hasCaptions: boolean;
  error?: string;
}> => {
  try {
    // Check if blocks have been created
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("id")
      .eq("note_id", noteId)
      .limit(1);

    if (blocksError) throw blocksError;

    // Check video metadata
    const { data: metadata, error: metaError } = await supabase
      .from("video_metadata")
      .select("captions")
      .eq("note_id", noteId)
      .single();

    if (metaError && metaError.code !== "PGRST116") throw metaError;

    return {
      isProcessing: blocks?.length === 0,
      hasTranscript: blocks?.length > 0,
      hasCaptions: !!metadata?.captions,
    };
  } catch (error) {
    console.error("Error checking video processing status:", error);
    return {
      isProcessing: false,
      hasTranscript: false,
      hasCaptions: false,
      error: "Failed to check processing status",
    };
  }
};