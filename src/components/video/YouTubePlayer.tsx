import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Youtube,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/services/youtubeService";

interface YouTubePlayerProps {
  videoId: string;
  onTimeUpdate?: (time: number) => void;
  onSeek?: (time: number) => void;
  startTime?: number;
  className?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  onTimeUpdate,
  onSeek,
  startTime = 0,
  className,
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isReady, setIsReady] = useState(false);

  // Load YouTube IFrame API
  useEffect(() => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      initializePlayer();
    };

    // Cleanup
    return () => {
      if (player) {
        player.destroy();
      }
    };
  }, [videoId]);

  const initializePlayer = () => {
    if (playerRef.current && window.YT) {
      const newPlayer = new window.YT.Player(playerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          start: startTime,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
      setPlayer(newPlayer);
    }
  };

  const onPlayerReady = (event: any) => {
    setIsReady(true);
    setDuration(event.target.getDuration());
    
    // Start time update interval
    const interval = setInterval(() => {
      if (player && player.getCurrentTime) {
        const time = player.getCurrentTime();
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }
    }, 100);

    // Store interval ID for cleanup
    (playerRef.current as any).timeInterval = interval;
  };

  const onPlayerStateChange = (event: any) => {
    setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if ((playerRef.current as any)?.timeInterval) {
        clearInterval((playerRef.current as any).timeInterval);
      }
    };
  }, []);

  const togglePlayPause = () => {
    if (!player) return;
    
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const handleSeek = (value: number[]) => {
    if (!player) return;
    
    const time = value[0];
    player.seekTo(time, true);
    setCurrentTime(time);
    onSeek?.(time);
  };

  const handleSkip = (seconds: number) => {
    if (!player) return;
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    player.seekTo(newTime, true);
    setCurrentTime(newTime);
    onSeek?.(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!player) return;
    
    const vol = value[0];
    setVolume(vol);
    player.setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!player) return;
    
    if (isMuted) {
      player.unMute();
      player.setVolume(volume || 100);
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (!player) return;
    
    player.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  // Public method to seek from outside
  useEffect(() => {
    if (player && isReady && startTime) {
      player.seekTo(startTime, true);
    }
  }, [player, isReady, startTime]);

  return (
    <Card className={cn("overflow-hidden", className)} ref={containerRef}>
      <div className="relative bg-black aspect-video">
        <div ref={playerRef} className="absolute inset-0" />
        
        {/* Custom Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-3">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-white/80 mt-1">
              <span>{formatDuration(Math.floor(currentTime))}</span>
              <span>{formatDuration(Math.floor(duration))}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={() => handleSkip(-10)}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={togglePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={() => handleSkip(10)}
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="w-24"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    {playbackRate}x
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <DropdownMenuItem
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                    >
                      {rate}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Fullscreen */}
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex items-center gap-2 text-white">
              <Youtube className="h-8 w-8 animate-pulse" />
              <span>Loading video...</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};