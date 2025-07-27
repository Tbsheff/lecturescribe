import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioInputCard } from "@/components/ui/AudioInputCard";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { Mic, Upload, Search, RefreshCw, Loader2, Grid3X3, List, Calendar, Clock, ChevronRight, PanelLeftClose, PanelLeft, Youtube } from "lucide-react";
import { Note } from "@/components/notes/NoteCard";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchNotes } from "@/services/transcription";
import FolderTree, { FolderItem, NoteItem } from "@/components/notes/FolderTree";
import { buildFolderTree, createFolder, updateFolder, deleteFolder, moveFolder, moveNote } from "@/services/folderService";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isToday, isThisWeek, isThisMonth, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Folder, AudioLines, Hash } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useViewPreferences } from "@/hooks/use-view-preferences";
import { YouTubeInput } from "@/components/video/YouTubeInput";

type InputMethod = "record" | "upload" | "url" | "youtube";
type ViewMode = "grid" | "list" | "timeline";
type DateGroup = "today" | "thisWeek" | "thisMonth" | "older";

interface EnhancedNote extends Note {
  folderId?: string | null;
  folderPath?: string[];
  audioUrl?: string;
  wordCount?: number;
  duration?: string;
  tags?: string[];
}

interface GroupedNotes {
  today: EnhancedNote[];
  thisWeek: EnhancedNote[];
  thisMonth: EnhancedNote[];
  older: EnhancedNote[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [inputMethod, setInputMethod] = useState<InputMethod>("record");
  const [notes, setNotes] = useState<EnhancedNote[]>([]);
  const [folderTree, setFolderTree] = useState<(FolderItem | NoteItem)[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFoldersLoading, setIsFoldersLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Use persisted view preferences
  const {
    viewMode,
    dateFilter,
    showFolderSidebar,
    expandedGroups,
    expandedFolders,
    setViewMode,
    setDateFilter,
    setShowFolderSidebar,
    setExpandedGroup,
    toggleFolderExpansion,
  } = useViewPreferences();

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setNotes([]);
        setFolderTree([]);
        return;
      }

      await Promise.all([loadNotes(), loadFolderTree()]);
    };

    loadData();
  }, [user, refreshTrigger]);

  const loadNotes = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const fetchedNotes = await fetchNotes(user.id);

      const formattedNotes: EnhancedNote[] = fetchedNotes.map((note: any) => ({
        id: note.id,
        title: note.title,
        date: new Date(note.created_at),
        preview: note.structured_summary?.summary || note.raw_summary?.substring(0, 200) || "No summary available",
        folderId: note.folder_id,
        audioUrl: note.audio_url,
        wordCount: note.transcription?.split(/\s+/).length || 0,
        duration: note.audio_duration,
        tags: extractTags(note),
      }));

      setNotes(formattedNotes);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      toast.error("Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolderTree = async () => {
    if (!user) return;

    try {
      setIsFoldersLoading(true);
      const tree = await buildFolderTree(user.id);
      setFolderTree(tree);
    } catch (error: any) {
      console.error("Error loading folder tree:", error);
      toast.error(`Failed to load folders: ${error.message}`);
    } finally {
      setIsFoldersLoading(false);
    }
  };

  const extractTags = (note: any): string[] => {
    const tags: string[] = [];
    
    if (note.structured_summary?.keyPoints) {
      const topics = note.structured_summary.keyPoints
        .join(" ")
        .match(/#\w+/g);
      if (topics) tags.push(...topics);
    }
    
    return [...new Set(tags)];
  };

  const groupNotesByDate = (notes: EnhancedNote[]): GroupedNotes => {
    return notes.reduce(
      (groups, note) => {
        if (isToday(note.date)) {
          groups.today.push(note);
        } else if (isThisWeek(note.date)) {
          groups.thisWeek.push(note);
        } else if (isThisMonth(note.date)) {
          groups.thisMonth.push(note);
        } else {
          groups.older.push(note);
        }
        return groups;
      },
      { today: [], thisWeek: [], thisMonth: [], older: [] } as GroupedNotes
    );
  };

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
            note.preview.toLowerCase().includes(searchQuery.toLowerCase())) ||
          note.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : notes;

  const folderFilteredNotes = selectedFolderId
    ? filteredNotes.filter(note => note.folderId === selectedFolderId)
    : filteredNotes;

  const dateFilteredNotes = dateFilter === "all"
    ? folderFilteredNotes
    : folderFilteredNotes.filter(note => {
        switch (dateFilter) {
          case "today":
            return isToday(note.date);
          case "thisWeek":
            return isThisWeek(note.date);
          case "thisMonth":
            return isThisMonth(note.date);
          case "older":
            return !isToday(note.date) && !isThisWeek(note.date) && !isThisMonth(note.date);
          default:
            return true;
        }
      });

  const groupedNotes = groupNotesByDate(dateFilteredNotes);

  const renderNoteCard = (note: EnhancedNote) => {
    if (viewMode === "list") {
      return (
        <Card 
          key={note.id}
          className="cursor-pointer border border-border/50 hover:border-brand/30 transition-all duration-300 card-hover"
          onClick={() => handleNoteClick(note.id)}
        >
          <CardContent className="p-4 flex items-center">
            <div className="bg-secondary rounded-md p-2 mr-3">
              <FileText className="h-5 w-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{note.title}</h3>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(note.date, { addSuffix: true })}
                {note.wordCount && ` • ${note.wordCount} words`}
              </p>
              {note.preview && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {note.preview}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card 
        key={note.id}
        className="cursor-pointer border border-border/50 hover:border-brand/30 transition-all duration-300 card-hover h-full"
        onClick={() => handleNoteClick(note.id)}
      >
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex items-start justify-between mb-3">
            <div className="bg-secondary rounded-md p-2">
              <FileText className="h-6 w-6 text-brand" />
            </div>
            {note.audioUrl && (
              <AudioLines className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{note.title}</h3>
          
          <p className="text-sm text-muted-foreground mb-3 line-clamp-3 flex-grow">
            {note.preview}
          </p>
          
          <div className="mt-auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(note.date, { addSuffix: true })}</span>
              {note.wordCount && (
                <>
                  <span>•</span>
                  <span>{note.wordCount} words</span>
                </>
              )}
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {note.tags.slice(0, 3).map((tag, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs"
                  >
                    <Hash className="h-2.5 w-2.5" />
                    {tag.replace("#", "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDateGroup = (title: string, notes: EnhancedNote[], groupKey: DateGroup) => {
    if (notes.length === 0) return null;

    return (
      <Collapsible
        open={expandedGroups[groupKey]}
        onOpenChange={(open) => setExpandedGroup(groupKey, open)}
        className="mb-6"
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-accent/50 rounded-md p-2 -ml-2">
          <div className="flex items-center gap-2">
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              expandedGroups[groupKey] && "rotate-90"
            )} />
            <h3 className="font-semibold text-lg">{title}</h3>
            <span className="text-sm text-muted-foreground">({notes.length})</span>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-3">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes.map(renderNoteCard)}
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(renderNoteCard)}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    if (!user) return;

    try {
      await createFolder(user.id, name, parentId);
      toast.success("Folder created successfully");
      loadFolderTree();
    } catch (error: any) {
      console.error("Error creating folder:", error);
      toast.error(`Failed to create folder: ${error.message}`);
    }
  };

  const handleRenameItem = async (
    id: string,
    newName: string,
    type: "folder" | "note"
  ) => {
    if (!user) return;

    try {
      if (type === "folder") {
        await updateFolder(user.id, id, newName);
        toast.success("Folder renamed successfully");
      } else {
        const { updateNoteTitle } = await import("@/services/noteStorage");
        await updateNoteTitle(user.id, id, newName);
        toast.success("Note renamed successfully");
      }
      loadFolderTree();
      handleRefresh();
    } catch (error: any) {
      console.error(`Error renaming ${type}:`, error);
      toast.error(`Failed to rename ${type}: ${error.message}`);
    }
  };

  const handleDeleteItem = async (id: string, type: "folder" | "note") => {
    if (!user) return;

    if (
      !confirm(
        `Are you sure you want to delete this ${type}? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      if (type === "folder") {
        await deleteFolder(user.id, id);
        toast.success("Folder deleted successfully");
      } else {
        const { deleteNote } = await import("@/services/noteStorage");
        await deleteNote(user.id, id);
        toast.success("Note deleted successfully");
      }
      loadFolderTree();
      handleRefresh();
    } catch (error: any) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(`Failed to delete ${type}: ${error.message}`);
    }
  };

  const handleMoveItem = async (
    id: string,
    newParentId: string | null,
    type: "folder" | "note"
  ) => {
    if (!user) return;

    try {
      if (type === "folder") {
        await moveFolder(user.id, id, newParentId);
        toast.success("Folder moved successfully");
      } else {
        await moveNote(user.id, id, newParentId);
        toast.success("Note moved successfully");
      }
      loadFolderTree();
      handleRefresh();
    } catch (error: any) {
      console.error(`Error moving ${type}:`, error);
      toast.error(`Failed to move ${type}: ${error.message}`);
    }
  };

  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(selectedFolderId === folderId ? null : folderId);
  };

  if (!loading && !user) {
    return <Navigate to="/auth" />;
  }

  return (
    <>
      <div className="flex h-[calc(100vh-2rem)]">
        {showFolderSidebar && (
          <div className="w-64 border-r bg-card/50 overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Folders</h2>
            </div>
            <ScrollArea className="flex-1">
              {isFoldersLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <FolderTree
                  items={folderTree}
                  onSelectNote={handleNoteClick}
                  onCreateFolder={handleCreateFolder}
                  onRenameItem={handleRenameItem}
                  onDeleteItem={handleDeleteItem}
                  onMoveItem={handleMoveItem}
                  selectedNoteId={selectedFolderId}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolderExpansion}
                />
              )}
            </ScrollArea>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8 flex items-start justify-between">
              <div>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFolderSidebar(!showFolderSidebar)}
                title={showFolderSidebar ? "Hide folders" : "Show folders"}
              >
                {showFolderSidebar ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
              </Button>
            </div>

            <div className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">New Note</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <AudioInputCard
                  icon={<Mic className="h-5 w-5" />}
                  title="Record Audio"
                  description="Use your microphone to record"
                  isActive={inputMethod === "record"}
                  onClick={() => setInputMethod("record")}
                />
                <AudioInputCard
                  icon={<Upload className="h-5 w-5" />}
                  title="Upload Audio"
                  description="MP3, WAV, or M4A files"
                  isActive={inputMethod === "upload"}
                  onClick={() => setInputMethod("upload")}
                />
                <AudioInputCard
                  icon={<Youtube className="h-5 w-5" />}
                  title="YouTube Video"
                  description="Import from YouTube"
                  isActive={inputMethod === "youtube"}
                  onClick={() => setInputMethod("youtube")}
                />
                <AudioInputCard
                  icon={<Search className="h-5 w-5" />}
                  title="Other Sources"
                  description="Coming soon"
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

              {inputMethod === "youtube" && (
                <div className="w-full max-w-2xl mx-auto">
                  <YouTubeInput
                    folderId={selectedFolderId}
                    onVideoProcessed={(noteId) => {
                      navigate(`/notes/${noteId}`);
                    }}
                  />
                </div>
              )}

              {inputMethod === "url" && (
                <div className="w-full max-w-lg mx-auto">
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Support for other video platforms coming soon!</p>
                  </div>
                </div>
              )}
            </div>

            <Separator className="my-8" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">My Notes</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-secondary rounded-lg p-1">
                    <Button
                      size="sm"
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      className="h-8 px-3"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === "list" ? "default" : "ghost"}
                      className="h-8 px-3"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  
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
                      className="pl-9 w-[300px]"
                      placeholder="Search notes, tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <Button
                  size="sm"
                  variant={dateFilter === "all" ? "default" : "outline"}
                  onClick={() => setDateFilter("all")}
                >
                  All Notes
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === "today" ? "default" : "outline"}
                  onClick={() => setDateFilter("today")}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === "thisWeek" ? "default" : "outline"}
                  onClick={() => setDateFilter("thisWeek")}
                >
                  This Week
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === "thisMonth" ? "default" : "outline"}
                  onClick={() => setDateFilter("thisMonth")}
                >
                  This Month
                </Button>
                <Button
                  size="sm"
                  variant={dateFilter === "older" ? "default" : "outline"}
                  onClick={() => setDateFilter("older")}
                >
                  Older
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : user ? (
                dateFilteredNotes.length > 0 ? (
                  dateFilter === "all" ? (
                    <>
                      {renderDateGroup("Today", groupedNotes.today, "today")}
                      {renderDateGroup("This Week", groupedNotes.thisWeek, "thisWeek")}
                      {renderDateGroup("This Month", groupedNotes.thisMonth, "thisMonth")}
                      {renderDateGroup("Older", groupedNotes.older, "older")}
                    </>
                  ) : (
                    viewMode === "grid" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dateFilteredNotes.map(renderNoteCard)}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dateFilteredNotes.map(renderNoteCard)}
                      </div>
                    )
                  )
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
        </div>
      </div>
    </>
  );
};

export default Dashboard;