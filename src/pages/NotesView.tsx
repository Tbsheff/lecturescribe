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
  Folder,
} from "lucide-react";
import { fetchNoteById } from "@/services/transcriptionService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

// React-markdown related imports
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

const NotesView = () => {
  const navigate = useNavigate();
  const { noteId } = useParams();
  const { user } = useAuth();
  const [note, setNote] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

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

      // Import the deleteNote function dynamically to avoid circular dependencies
      const { deleteNote } = await import("@/services/noteStorage");

      // Delete the note and all associated files
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

      // Import the updateNoteTitle function dynamically to avoid circular dependencies
      const { updateNoteTitle } = await import("@/services/noteStorage");

      // Update the note title
      await updateNoteTitle(user.id, note.id, newTitle.trim());

      // Update the local state
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
      <div className="container max-w-4xl mx-auto">
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

        <Tabs
          defaultValue="summary"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mb-8"
        >
          <TabsList className="mb-6">
            <TabsTrigger value="notes">Editor</TabsTrigger>
            <TabsTrigger value="summary">AI Summary</TabsTrigger>
            <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
            {note.audio_url && (
              <TabsTrigger value="audio">Audio Player</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="notes" className="mt-0 border-none h-full" style={{ minHeight: "500px" }}>

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
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-brand hover:prose-a:text-brand-dark prose-img:rounded-md prose-img:mx-auto">
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
                                <li
                                  key={index}
                                  className="prose prose-sm dark:prose-invert prose-a:text-brand hover:prose-a:text-brand-dark"
                                >
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

                    {note.structured_summary.sections &&
                      note.structured_summary.sections.length > 0 && (
                        <div className="space-y-6 pt-4">
                          {note.structured_summary.sections.map(
                            (section: any, index: number) => (
                              <div key={index} className="space-y-3">
                                <h3 className="text-lg font-medium">
                                  {section.title}
                                </h3>

                                {section.content && (
                                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-brand hover:prose-a:text-brand-dark prose-img:rounded-md prose-img:mx-auto prose-code:bg-muted prose-code:p-1 prose-code:rounded prose-code:text-sm">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[
                                        rehypeRaw,
                                        rehypeSanitize,
                                      ]}
                                    >
                                      {section.content}
                                    </ReactMarkdown>
                                  </div>
                                )}

                                {section.subsections &&
                                  section.subsections.length > 0 && (
                                    <div className="space-y-4 pl-4 border-l-2 border-muted mt-4">
                                      {section.subsections.map(
                                        (subsection: any, subIndex: number) => (
                                          <div key={subIndex} className="pl-4">
                                            <h4 className="text-base font-medium mb-2">
                                              {subsection.title}
                                            </h4>
                                            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-brand hover:prose-a:text-brand-dark prose-img:rounded-md prose-img:mx-auto prose-code:bg-muted prose-code:p-1 prose-code:rounded prose-code:text-sm">
                                              <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[
                                                  rehypeRaw,
                                                  rehypeSanitize,
                                                ]}
                                              >
                                                {subsection.content}
                                              </ReactMarkdown>
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                ) : note.raw_summary ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-brand hover:prose-a:text-brand-dark prose-img:rounded-md prose-img:mx-auto prose-code:bg-muted prose-code:p-1 prose-code:rounded prose-code:text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    >
                      {note.raw_summary}
                    </ReactMarkdown>
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
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-brand hover:prose-a:text-brand-dark prose-img:rounded-md prose-img:mx-auto prose-code:bg-muted prose-code:p-1 prose-code:rounded prose-code:text-sm">
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

          {note.audio_url && (
            <TabsContent value="audio">
              <Card>
                <CardHeader>
                  <CardTitle>Audio Recording</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center p-6">
                    {note.audio_url ? (
                      <audio
                        controls
                        src={note.audio_url}
                        className="w-full max-w-lg"
                        onError={(e) => {
                          console.error("Audio playback error:", e);
                          toast.error("Error playing audio file");
                        }}
                      />
                    ) : (
                      <p className="text-muted-foreground">
                        Audio file not available
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
};

export default NotesView;
