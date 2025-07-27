import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  ArrowLeft,
  Download,
  Trash2,
  Edit,
  Check,
  X,
  FileText,
  Blocks,
  Play,
  Pause,
  SkipForward,
  SkipBack,
} from "lucide-react";
import { fetchNoteById } from "@/services/transcriptionService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "@/components/blocks/BlockEditor";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { isNoteMigrated, migrateNoteToBlocks } from "@/services/noteBlockMigration";

// React-markdown related imports
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

const BlockNotesView = () => {
  const navigate = useNavigate();
  const { noteId } = useParams();
  const { user } = useAuth();
  const [note, setNote] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("blocks");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const loadNote = async () => {
      if (!noteId || !user) {
        navigate("/");
        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchNoteById(noteId);
        if (!data) {
          toast.error("Note not found");
          navigate("/");
          return;
        }

        setNote(data);
        setNewTitle(data.title || "");
        
        // Check if note needs migration to blocks
        const isMigrated = await isNoteMigrated(noteId);
        if (!isMigrated) {
          toast.info("Migrating note to new format...");
          try {
            await migrateNoteToBlocks(noteId, data);
            toast.success("Note migrated successfully!");
          } catch (error) {
            console.error("Migration error:", error);
            toast.error("Failed to migrate note, but you can still view it");
          }
        }
      } catch (error: any) {
        console.error("Error loading note:", error);
        toast.error(`Failed to load note: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadNote();
  }, [noteId, navigate, user]);

  const handleDelete = async () => {
    if (!note || !user) return;

    if (
      !confirm(
        "Are you sure you want to delete this note? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);

      const { deleteNote } = await import("@/services/noteStorage");
      await deleteNote(user.id, note.id);

      toast.success("Note deleted successfully");
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error(`Failed to delete note: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!note?.audio_url) {
      toast.error("No audio available for this note");
      return;
    }

    window.open(note.audio_url, "_blank");
  };

  const handleEditTitle = () => {
    setIsEditingTitle(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 50);
  };

  const handleSaveTitle = async () => {
    if (!note || !user) return;
    if (!newTitle.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    try {
      setIsSavingTitle(true);

      const { updateNoteTitle } = await import("@/services/noteStorage");
      await updateNoteTitle(user.id, note.id, newTitle.trim());

      setNote({ ...note, title: newTitle.trim() });
      setIsEditingTitle(false);
      toast.success("Title updated successfully");
    } catch (error: any) {
      console.error("Error updating title:", error);
      toast.error(`Failed to update title: ${error.message}`);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelEditTitle = () => {
    setNewTitle(note.title || "");
    setIsEditingTitle(false);
  };

  // Audio player handlers
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!note) {
    return (
      <>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Note not found</h2>
          <p className="text-muted-foreground mt-2">
            The note you're looking for doesn't exist or you don't have access
            to it.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </>
    );
  }

  const formattedDate = note.created_at
    ? format(new Date(note.created_at), "PP")
    : "";

  return (
    <>
      <div className="container max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-2">
            {note.audio_url && (
              <Button
                variant="outline"
                onClick={handleDownloadAudio}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Audio
              </Button>
            )}

            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-2"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </div>
        </div>

        <div className="mb-6">
          {isEditingTitle ? (
            <div className="flex items-center gap-2 mb-2">
              <Input
                ref={titleInputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2"
                placeholder="Enter note title"
                onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSaveTitle}
                disabled={isSavingTitle}
              >
                {isSavingTitle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancelEditTitle}
                disabled={isSavingTitle}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2 group">
              <h1 className="text-3xl font-bold">{note.title}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleEditTitle}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-muted-foreground">{formattedDate}</p>
        </div>

        {/* Audio Player */}
        {note.audio_url && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <audio
                ref={audioRef}
                src={note.audio_url}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setIsPlaying(false)}
              />
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleSkip(-10)}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="icon"
                    onClick={togglePlayPause}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleSkip(10)}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex-1">
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={1}
                      onValueChange={handleSeek}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Speed:</span>
                    <select
                      value={playbackRate}
                      onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs
          defaultValue="blocks"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mb-8"
        >
          <TabsList className="mb-6">
            <TabsTrigger value="blocks" className="gap-2">
              <Blocks className="h-4 w-4" />
              Block Editor
            </TabsTrigger>
            <TabsTrigger value="summary">AI Summary</TabsTrigger>
            <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
          </TabsList>

          <TabsContent value="blocks" className="mt-0 border-none">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Blocks className="h-5 w-5" />
                  Note Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BlockEditor 
                  noteId={noteId!}
                  readOnly={false}
                  onTimestampClick={(timestamp) => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = timestamp;
                      if (!isPlaying) {
                        audioRef.current.play();
                        setIsPlaying(true);
                      }
                    }
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary" className="min-h-[60vh]">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {note.structured_summary ? (
                  <div className="space-y-6">
                    {note.structured_summary.summary && (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeSanitize]}
                        >
                          {note.structured_summary.summary}
                        </ReactMarkdown>
                      </div>
                    )}

                    {note.structured_summary.keyPoints &&
                      note.structured_summary.keyPoints.length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-2">
                            Key Points
                          </h3>
                          <ul className="list-disc pl-6 space-y-1">
                            {note.structured_summary.keyPoints.map(
                              (point: string, index: number) => (
                                <li key={index} className="prose prose-sm dark:prose-invert">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                                  >
                                    {point}
                                  </ReactMarkdown>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No summary available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>Full Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh] rounded-md border p-4">
                  {note.transcription ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeSanitize]}
                      >
                        {note.transcription}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No transcript available
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default BlockNotesView;