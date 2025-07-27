import React from "react";
import FolderTree, { FolderItem, NoteItem } from "./FolderTree";
import { useViewPreferences } from "@/hooks/use-view-preferences";

interface PersistentFolderTreeProps {
  items: (FolderItem | NoteItem)[];
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

const PersistentFolderTree: React.FC<PersistentFolderTreeProps> = (props) => {
  const { expandedFolders, toggleFolderExpansion } = useViewPreferences();

  // Create a wrapper component that manages expanded state
  return (
    <div className="persistent-folder-tree">
      <style>{`
        .persistent-folder-tree [data-folder-id] {
          cursor: pointer;
        }
      `}</style>
      <FolderTree
        {...props}
        expandedFolders={expandedFolders}
        onToggleFolder={toggleFolderExpansion}
      />
    </div>
  );
};

export default PersistentFolderTree;