import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Youtube, Video, AlertCircle } from "lucide-react";
import {
  isYouTubeUrl,
  extractVideoId,
  getVideoMetadata,
  formatDuration,
  createNoteFromYouTube,
  YouTubeVideoInfo,
} from "@/services/youtubeService";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface YouTubeInputProps {
  onVideoProcessed?: (noteId: string) => void;
  folderId?: string | null;
}

export const YouTubeInput: React.FC<YouTubeInputProps> = ({
  onVideoProcessed,
  folderId,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoInfo, setVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset states when URL changes
    if (!url) {
      setVideoInfo(null);
      setError(null);
    }
  }, [url]);

  const handleUrlChange = async (value: string) => {
    setUrl(value);
    setError(null);

    if (!value) {
      setVideoInfo(null);
      return;
    }

    if (isYouTubeUrl(value)) {
      const videoId = extractVideoId(value);
      if (videoId) {
        await fetchVideoInfo(videoId);
      }
    }
  };

  const fetchVideoInfo = async (videoId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const info = await getVideoMetadata(videoId);
      setVideoInfo(info);
    } catch (error: any) {
      console.error("Error fetching video info:", error);
      setError(error.message || "Failed to fetch video information");
      setVideoInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!user || !videoInfo) return;

    try {
      setIsProcessing(true);
      toast.info("Creating note from YouTube video...");

      const noteId = await createNoteFromYouTube(user.id, url, folderId);

      toast.success("Note created! Processing video...");
      
      if (onVideoProcessed) {
        onVideoProcessed(noteId);
      } else {
        navigate(`/notes/${noteId}`);
      }
    } catch (error: any) {
      console.error("Error processing video:", error);
      toast.error(error.message || "Failed to process video");
    } finally {
      setIsProcessing(false);
    }
  };

  const isValidUrl = isYouTubeUrl(url);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <Input
            placeholder="Paste a YouTube URL (e.g., https://youtube.com/watch?v=...)"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            className={error ? "border-destructive" : ""}
            disabled={isProcessing}
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}
        </div>
        <Button
          onClick={handleProcess}
          disabled={!isValidUrl || !videoInfo || isProcessing || !user}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Video className="h-4 w-4 mr-2" />
              Process Video
            </>
          )}
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading video information...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {videoInfo && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-2">
              <Youtube className="h-5 w-5 text-red-600 mt-0.5" />
              <CardTitle className="text-lg flex-1">Video Preview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-40 h-24 object-cover rounded"
              />
              <div className="flex-1 space-y-1">
                <h3 className="font-medium line-clamp-2">{videoInfo.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {videoInfo.channelName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Duration: {formatDuration(videoInfo.duration)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!user && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to process YouTube videos
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};