import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  Plus,
  MoreHorizontal,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface FolderItem {
  id: string;
  name: string;
  type: "folder";
  children: (FolderItem | NoteItem)[];
  parentId: string | null;
}

export interface NoteItem {
  id: string;
  name: string;
  type: "note";
  parentId: string | null;
}

type TreeItem = FolderItem | NoteItem;

interface FolderTreeProps {
  items: TreeItem[];
  onSelectNote: (noteId: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameItem: (id: string, newName: string, type: "folder" | "note") => void;
  onDeleteItem: (id: string, type: "folder" | "note") => void;
  onMoveItem: (
    id: string,
    newParentId: string | null,
    type: "folder" | "note",
  ) => void;
  selectedNoteId?: string;
}

const FolderTree: React.FC<FolderTreeProps> = ({
  items,
  onSelectNote,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  onMoveItem,
  selectedNoteId,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<{
    id: string;
    name: string;
    type: "folder" | "note";
  } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    type: "folder" | "note";
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name cannot be empty");
      return;
    }
    onCreateFolder(newFolderName, currentParentId);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  };

  const openCreateFolderDialog = (parentId: string | null) => {
    setCurrentParentId(parentId);
    setNewFolderName("");
    setIsCreateFolderOpen(true);
  };

  const handleRenameItem = () => {
    if (!itemToRename || !newItemName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    onRenameItem(itemToRename.id, newItemName, itemToRename.type);
    setIsRenameDialogOpen(false);
    setItemToRename(null);
    setNewItemName("");
  };

  const openRenameDialog = (item: {
    id: string;
    name: string;
    type: "folder" | "note";
  }) => {
    setItemToRename(item);
    setNewItemName(item.name);
    setIsRenameDialogOpen(true);
  };

  const handleDragStart = (
    e: React.DragEvent,
    item: { id: string; type: "folder" | "note" },
  ) => {
    setDraggedItem(item);
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    if (draggedItem && draggedItem.id !== targetId) {
      setDropTarget(targetId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    if (draggedItem && draggedItem.id !== targetId) {
      onMoveItem(draggedItem.id, targetId, draggedItem.type);
    }
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const renderTree = (
    treeItems: TreeItem[],
    level = 0,
    parentId: string | null = null,
  ) => {
    return treeItems
      .filter((item) => item.parentId === parentId)
      .map((item) => {
        const isFolder = item.type === "folder";
        const isExpanded = isFolder && expandedFolders[item.id];
        const isSelected = !isFolder && item.id === selectedNoteId;
        const isDropTarget = dropTarget === item.id;

        return (
          <div key={item.id} className="select-none">
            <div
              className={cn(
                "flex items-center py-1 px-2 rounded-md hover:bg-accent/50 cursor-pointer",
                isSelected && "bg-accent text-accent-foreground",
                isDropTarget &&
                  "bg-accent/30 border border-dashed border-primary",
              )}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onClick={() =>
                isFolder ? toggleFolder(item.id) : onSelectNote(item.id)
              }
              draggable
              onDragStart={(e) =>
                handleDragStart(e, { id: item.id, type: item.type })
              }
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
            >
              {isFolder ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(item.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <div className="w-5"></div>
              )}

              {isFolder ? (
                <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
              ) : (
                <File className="h-4 w-4 mr-2 text-muted-foreground" />
              )}

              <span className="text-sm truncate flex-1">{item.name}</span>

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      openRenameDialog({
                        id: item.id,
                        name: item.name,
                        type: item.type,
                      })
                    }
                  >
                    Rename
                  </DropdownMenuItem>
                  {isFolder && (
                    <DropdownMenuItem
                      onClick={() => openCreateFolderDialog(item.id)}
                    >
                      New Folder
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteItem(item.id, item.type)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isFolder && isExpanded && (
              <div className="ml-2">
                {renderTree((item as FolderItem).children, level + 1, item.id)}
              </div>
            )}
          </div>
        );
      });
  };

  return (
    <div className="w-full h-full overflow-auto">
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="font-medium">Folders</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openCreateFolderDialog(null)}
          title="New Root Folder"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-2">
        {items.length > 0 ? (
          renderTree(items)
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No folders or notes</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => openCreateFolderDialog(null)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Folder
            </Button>
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename {itemToRename?.type === "folder" ? "Folder" : "Note"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder={`${itemToRename?.type === "folder" ? "Folder" : "Note"} name`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameItem()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameItem}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FolderTree;
