import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioInputCard } from "@/components/ui/AudioInputCard";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { Mic, Upload, Search, RefreshCw, Loader2 } from "lucide-react";
import { NoteList } from "@/components/notes/NoteList";
import { Note } from "@/components/notes/NoteCard";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchNotes } from "@/services/transcription";

type InputMethod = "record" | "upload" | "url";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [inputMethod, setInputMethod] = useState<InputMethod>("record");
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const loadNotes = async () => {
      if (!user) {
        setNotes([]);
        return;
      }

      try {
        setIsLoading(true);
        const fetchedNotes = await fetchNotes(user.id);

        const formattedNotes: Note[] = fetchedNotes.map((note: any) => ({
          id: note.id,
          title: note.title,
          date: new Date(note.created_at),
          preview: note.structured_summary?.summary || "No summary available",
        }));

        setNotes(formattedNotes);
      } catch (error: any) {
        console.error("Error fetching notes:", error);
        toast.error("Failed to load notes");
      } finally {
        setIsLoading(false);
      }
    };

    loadNotes();
  }, [user, refreshTrigger]);

  const handleNoteClick = (noteId: string) => {
    navigate(`/notes/${noteId}`);
  };

  const handleUrlSubmit = () => {
    toast.error("URL processing is not implemented yet");
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const filteredNotes = searchQuery
    ? notes.filter(
        (note) =>
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (note.preview &&
            note.preview.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : notes;

  // Handle auth redirect in the render phase, not before hooks
  if (!loading && !user) {
    return <Navigate to="/auth" />;
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text">
            Lecture<span>Scribe</span>
          </h1>
          <p className="text-muted-foreground">
            Transform lectures into structured notes with AI
          </p>
          {user && (
            <p className="text-sm text-muted-foreground mt-1">
              Welcome, {user.email}
            </p>
          )}
        </div>

        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">New Note</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <AudioInputCard
              icon={<Mic className="h-5 w-5" />}
              title="Record Audio"
              description="Use your microphone to record lectures"
              isActive={inputMethod === "record"}
              onClick={() => setInputMethod("record")}
            />
            <AudioInputCard
              icon={<Upload className="h-5 w-5" />}
              title="Upload Audio"
              description="Upload MP3, WAV, or M4A files"
              isActive={inputMethod === "upload"}
              onClick={() => setInputMethod("upload")}
            />
            <AudioInputCard
              icon={<Search className="h-5 w-5" />}
              title="Web Link"
              description="Link to YouTube or other sources"
              isActive={inputMethod === "url"}
              onClick={() => setInputMethod("url")}
            />
          </div>

          {inputMethod === "record" && <AudioRecorder />}

          {inputMethod === "upload" && (
            <AudioUploader
              onAudioUploaded={(noteId) => {
                toast.info("File upload processing is in progress...");
                if (noteId) {
                  navigate(`/notes/${noteId}`);
                }
              }}
            />
          )}

          {inputMethod === "url" && (
            <div className="w-full max-w-lg mx-auto">
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Paste a YouTube URL, Google Drive link, etc."
                  className="flex-1"
                />
                <Button onClick={handleUrlSubmit}>Process</Button>
              </div>
            </div>
          )}
        </div>

        <Separator className="my-8" />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">My Notes</h2>
            <div className="flex items-center gap-4">
              <Button
                size="icon"
                variant="outline"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 max-w-xs"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Tabs defaultValue="all" className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All Notes</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            filteredNotes.length > 0 ? (
              <NoteList notes={filteredNotes} onNoteClick={handleNoteClick} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>
                  No notes found. Start recording or uploading to create your
                  first note!
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Please sign in to view your notes.</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => navigate("/auth")}
              >
                Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
