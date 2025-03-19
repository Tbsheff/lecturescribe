import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
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
  Eye,
  PenSquare,
} from "lucide-react";
import { fetchNoteById } from "@/services/transcriptionService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import AIPageEditor from "@/components/notes/pageEditor";
import AIGeneratedNotesView from "@/components/notes/AIGeneratedNotesView";
import { JSONContent } from "novel";

// React-markdown related imports
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

// Interface for the note object from database
interface DatabaseNote {
  id: string;
  user_id: string;
  title: string;
  transcription?: string | null;
  audio_url?: string | null;
  created_at: string;
  raw_summary?: string | null;
  structured_summary?: any | null; // Using any instead of JSONContent for compatibility
  content?: string | null;
  [key: string]: any; // Allow for any additional properties
}

// Default content for empty notes
const defaultContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "" }]
    }
  ]
};

const NotesView = () => {
  const navigate = useNavigate();
  const { noteId } = useParams();
  const { user } = useAuth();
  const [note, setNote] = useState<DatabaseNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("editor");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // For AI generated content
  const [aiGeneratedContent, setAiGeneratedContent] = useState('');
  const [showAITab, setShowAITab] = useState(false);

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

        // Ensure note has proper content structure
        if (!data.content) {
          data.content = JSON.stringify({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: data.transcription || "" }]
              }
            ]
          });
        }

        // Transform the data into a DatabaseNote
        const noteData: DatabaseNote = {
          id: data.id || noteId,
          user_id: user.id,
          title: data.title || "Untitled Note",
          transcription: data.transcription || null,
          audio_url: data.audioUrl || null,
          created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
          raw_summary: data.summary || null,
          structured_summary: data.structuredSummary || null,
          content: data.content || null
        };

        setNote(noteData);
        setNewTitle(noteData.title);

        // Check if AI notes exist
        if (noteData.raw_summary) {
          setAiGeneratedContent(noteData.raw_summary);
          setShowAITab(true);
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
        "Are you sure you want to delete this note? This action cannot be undone."
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

  const handleGenerateAINotes = async () => {
    if (!note || !user) return;

    try {
      setIsLoading(true);

      // This would be replaced with an actual API call to generate AI notes
      // For example, using the transcription stored in the note
      const transcription = note?.transcription || '';

      if (!transcription) {
        toast.error('No transcription available to generate notes from');
        return;
      }

      // In a real implementation, you would send the transcription to an API
      // and get back AI-generated notes
      const mockAIGeneratedContent = `# AI Generated Notes for ${note.title}

## Key Points:
- First important point from the lecture
- Second important point
- Third important point

## Summary:
This lecture covered several important concepts...`;

      // Save the AI notes to the database
      const { error } = await supabase
        .from('notes')
        .update({
          raw_summary: mockAIGeneratedContent,
        })
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update UI
      setAiGeneratedContent(mockAIGeneratedContent);
      setShowAITab(true);
      setActiveTab('ai-notes');

      toast.success('AI notes generated successfully');
    } catch (error) {
      console.error('Error generating AI notes:', error);
      toast.error('Failed to generate AI notes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscardAINotes = async () => {
    if (!note || !user) return;

    try {
      // Clear AI notes from database
      const { error } = await supabase
        .from('notes')
        .update({
          raw_summary: null,
          structured_summary: null
        })
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update UI
      setAiGeneratedContent('');
      setShowAITab(false);
      setActiveTab('editor');

      toast.success('AI notes discarded');
    } catch (error) {
      console.error('Error discarding AI notes:', error);
      toast.error('Failed to discard AI notes');
    }
  };

  const handleSaveComplete = () => {
    // Refresh the note data after saving
    if (noteId && user) {
      const fetchUpdatedNote = async () => {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', noteId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error refreshing note:', error);
          return;
        }

        if (data) {
          // Convert database row to DatabaseNote format
          const updatedNote: DatabaseNote = {
            id: data.id,
            user_id: data.user_id,
            title: data.title || "Untitled Note",
            transcription: data.transcription,
            audio_url: data.audio_url,
            created_at: data.created_at,
            raw_summary: data.raw_summary,
            structured_summary: data.structured_summary,
          };
          setNote(updatedNote);
        }
      };

      fetchUpdatedNote();
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!note) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Note not found</h2>
          <p className="text-muted-foreground mt-2">
            The note you're looking for doesn't exist or you don't have access
            to it.
          </p>
          <Button onClick={() => navigate("/")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8 max-w-7xl mx-auto">
        <div className="flex items-center mb-6 flex-wrap gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {isEditingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                ref={titleInputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xl font-bold h-10 max-w-md"
                placeholder="Enter note title"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveTitle}
                disabled={isSavingTitle}
              >
                {isSavingTitle ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-green-500" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEditTitle}
                disabled={isSavingTitle}
              >
                <X className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <h1 className="text-2xl font-bold truncate">
                {note.title || "Untitled Note"}
              </h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditTitle}
                className="ml-2"
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {note.audio_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAudio}
              >
                <Download className="w-4 h-4 mr-2" />
                Audio
              </Button>
            )}

            {!showAITab && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAINotes}
                disabled={isLoading}
              >
                <PenSquare className="w-4 h-4 mr-2" />
                Generate AI Notes
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Note
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-6">
          {note.created_at && (
            <div>
              Created{" "}
              {format(
                new Date(note.created_at),
                "MMM d, yyyy 'at' h:mm a"
              )}
            </div>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="editor">Notes Editor</TabsTrigger>
            <TabsTrigger value="ai-notes" disabled={!showAITab}>
              AI Notes
            </TabsTrigger>
            {note.transcription && (
              <TabsTrigger value="transcript">Full Transcript</TabsTrigger>
            )}
            {note.audio_url && <TabsTrigger value="audio">Audio</TabsTrigger>}
          </TabsList>

          <TabsContent value="editor">
            <Card>
              <CardHeader>
                <CardTitle>Note Editor</CardTitle>
              </CardHeader>
              <CardContent>
                {note && user && (
                  <AIPageEditor
                    initialAIContent={
                      note.structured_summary ||
                      {
                        type: "doc",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: note.transcription || "" }]
                          }
                        ]
                      }
                    }
                    onSave={async (html, json, markdown) => {
                      // Save the updated notes
                      const { error } = await supabase
                        .from('notes')
                        .update({
                          raw_summary: markdown,
                          structured_summary: json
                        })
                        .eq('id', note.id)
                        .eq('user_id', user.id);

                      if (error) {
                        toast.error('Failed to save notes');
                        throw error;
                      }
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-notes">
            <Card>
              <CardContent className="p-6">
                {showAITab && (
                  <AIGeneratedNotesView
                    noteId={note.id}
                    userId={user.id}
                    aiGeneratedContent={aiGeneratedContent}
                    onSaveComplete={handleSaveComplete}
                    onDiscardAINotes={handleDiscardAINotes}
                  />
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
    </MainLayout>
  );
};

export default NotesView;
