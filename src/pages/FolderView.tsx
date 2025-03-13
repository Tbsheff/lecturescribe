import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import FolderTree, {
  FolderItem,
  NoteItem,
} from "@/components/notes/FolderTree";
import { Button } from "@/components/ui/button";
import { Plus, FolderPlus, FileText, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  buildFolderTree,
  createFolder,
  updateFolder,
  deleteFolder,
  moveFolder,
  moveNote,
} from "@/services/folderService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const FolderView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [folderTree, setFolderTree] = useState<(FolderItem | NoteItem)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadFolderTree();
  }, [user]);

  const loadFolderTree = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const tree = await buildFolderTree(user.id);
      setFolderTree(tree);
    } catch (error: any) {
      console.error("Error loading folder tree:", error);
      toast.error(`Failed to load folders: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
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
    type: "folder" | "note",
  ) => {
    if (!user) return;

    try {
      if (type === "folder") {
        await updateFolder(user.id, id, newName);
        toast.success("Folder renamed successfully");
      } else {
        // Import dynamically to avoid circular dependencies
        const { updateNoteTitle } = await import("@/services/noteStorage");
        await updateNoteTitle(user.id, id, newName);
        toast.success("Note renamed successfully");
      }
      loadFolderTree();
    } catch (error: any) {
      console.error(`Error renaming ${type}:`, error);
      toast.error(`Failed to rename ${type}: ${error.message}`);
    }
  };

  const handleDeleteItem = async (id: string, type: "folder" | "note") => {
    if (!user) return;

    if (
      !confirm(
        `Are you sure you want to delete this ${type}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      if (type === "folder") {
        await deleteFolder(user.id, id);
        toast.success("Folder deleted successfully");
      } else {
        // Import dynamically to avoid circular dependencies
        const { deleteNote } = await import("@/services/noteStorage");
        await deleteNote(user.id, id);
        toast.success("Note deleted successfully");
      }
      loadFolderTree();
    } catch (error: any) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(`Failed to delete ${type}: ${error.message}`);
    }
  };

  const handleMoveItem = async (
    id: string,
    newParentId: string | null,
    type: "folder" | "note",
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
    } catch (error: any) {
      console.error(`Error moving ${type}:`, error);
      toast.error(`Failed to move ${type}: ${error.message}`);
    }
  };

  const handleSelectNote = (noteId: string) => {
    navigate(`/notes/${noteId}`);
  };

  const handleCreateNote = async () => {
    if (!user || !newNoteName.trim()) {
      toast.error("Note name cannot be empty");
      return;
    }

    try {
      // Import dynamically to avoid circular dependencies
      const { createEmptyNote } = await import("@/services/noteStorage");
      const noteId = await createEmptyNote(
        user.id,
        newNoteName,
        selectedFolderId,
      );
      setIsCreateNoteOpen(false);
      setNewNoteName("");
      toast.success("Note created successfully");
      navigate(`/notes/${noteId}`);
    } catch (error: any) {
      console.error("Error creating note:", error);
      toast.error(`Failed to create note: ${error.message}`);
    }
  };

  const openCreateNoteDialog = (folderId: string | null = null) => {
    setSelectedFolderId(folderId);
    setNewNoteName("");
    setIsCreateNoteOpen(true);
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2 mr-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold gradient-text">Folders</h1>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => openCreateNoteDialog(null)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              New Note
            </Button>
            <Button
              onClick={() => handleCreateFolder("New Folder", null)}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 border rounded-lg overflow-hidden bg-card h-[calc(100vh-12rem)]">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <p>Loading folders...</p>
              </div>
            ) : (
              <FolderTree
                items={folderTree}
                onSelectNote={handleSelectNote}
                onCreateFolder={handleCreateFolder}
                onRenameItem={handleRenameItem}
                onDeleteItem={handleDeleteItem}
                onMoveItem={handleMoveItem}
              />
            )}
          </div>

          <div className="md:col-span-3 border rounded-lg p-6 bg-card h-[calc(100vh-12rem)] flex flex-col items-center justify-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-medium mb-2">
              Select a note or create a new one
            </h2>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Click on a note in the folder tree to view and edit it, or create
              a new note to get started.
            </p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go to Notes
              </Button>
              <Button
                onClick={() => openCreateNoteDialog(null)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Note
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Note Dialog */}
      <Dialog open={isCreateNoteOpen} onOpenChange={setIsCreateNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Note name"
              value={newNoteName}
              onChange={(e) => setNewNoteName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateNote()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateNoteOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateNote}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default FolderView;
