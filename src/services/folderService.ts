import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

export interface Folder {
  id: string;
  name: string;
  user_id: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderStructure {
  id: string;
  name: string;
  type: "folder";
  children: (FolderStructure | NoteItem)[];
  parentId: string | null;
}

export interface NoteItem {
  id: string;
  name: string;
  type: "note";
  parentId: string | null;
}

/**
 * Create a new folder
 */
export const createFolder = async (
  userId: string,
  name: string,
  parentId: string | null = null,
): Promise<string> => {
  try {
    const folderId = uuidv4();
    const now = new Date().toISOString();

    const { error } = await supabase.from("folders").insert({
      id: folderId,
      name,
      user_id: userId,
      parent_id: parentId,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      console.error("Error creating folder:", error);
      throw new Error(`Failed to create folder: ${error.message}`);
    }

    return folderId;
  } catch (error) {
    console.error("Error in createFolder:", error);
    throw error;
  }
};

/**
 * Update a folder's name
 */
export const updateFolder = async (
  userId: string,
  folderId: string,
  name: string,
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("folders")
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", folderId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating folder:", error);
      throw new Error(`Failed to update folder: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in updateFolder:", error);
    throw error;
  }
};

/**
 * Delete a folder and all its contents
 */
export const deleteFolder = async (
  userId: string,
  folderId: string,
): Promise<void> => {
  try {
    // First, get all subfolders recursively
    const subfolders = await getSubfolders(userId, folderId);

    // Update notes to remove them from this folder
    const { error: noteUpdateError } = await supabase
      .from("note_metadata")
      .update({ folder_id: null })
      .eq("user_id", userId)
      .eq("folder_id", folderId);

    if (noteUpdateError) {
      console.error(
        "Error updating notes during folder deletion:",
        noteUpdateError,
      );
    }

    // Also update notes in subfolders
    for (const subfolderId of subfolders) {
      const { error: subNoteUpdateError } = await supabase
        .from("note_metadata")
        .update({ folder_id: null })
        .eq("user_id", userId)
        .eq("folder_id", subfolderId);

      if (subNoteUpdateError) {
        console.error(
          `Error updating notes in subfolder ${subfolderId}:`,
          subNoteUpdateError,
        );
      }
    }

    // Delete all subfolders
    if (subfolders.length > 0) {
      const { error: subfolderDeleteError } = await supabase
        .from("folders")
        .delete()
        .in("id", subfolders)
        .eq("user_id", userId);

      if (subfolderDeleteError) {
        console.error("Error deleting subfolders:", subfolderDeleteError);
      }
    }

    // Delete the main folder
    const { error } = await supabase
      .from("folders")
      .delete()
      .eq("id", folderId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting folder:", error);
      throw new Error(`Failed to delete folder: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in deleteFolder:", error);
    throw error;
  }
};

/**
 * Helper function to get all subfolder IDs recursively
 */
async function getSubfolders(
  userId: string,
  folderId: string,
): Promise<string[]> {
  const result: string[] = [];
  const toProcess: string[] = [folderId];
  const processed = new Set<string>();

  while (toProcess.length > 0) {
    const currentId = toProcess.pop()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);

    const { data, error } = await supabase
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .eq("parent_id", currentId);

    if (error) {
      console.error("Error fetching subfolders:", error);
      continue;
    }

    for (const folder of data) {
      result.push(folder.id);
      toProcess.push(folder.id);
    }
  }

  return result;
}

/**
 * Move a note to a different folder
 */
export const moveNote = async (
  userId: string,
  noteId: string,
  folderId: string | null,
): Promise<void> => {
  try {
    const { error } = await supabase
      .from("note_metadata")
      .update({
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error moving note:", error);
      throw new Error(`Failed to move note: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in moveNote:", error);
    throw error;
  }
};

/**
 * Move a folder to a different parent folder
 */
export const moveFolder = async (
  userId: string,
  folderId: string,
  newParentId: string | null,
): Promise<void> => {
  try {
    // Prevent circular references
    if (newParentId) {
      const isCircular = await wouldCreateCircularReference(
        userId,
        folderId,
        newParentId,
      );
      if (isCircular) {
        throw new Error("Cannot move a folder into its own subfolder");
      }
    }

    const { error } = await supabase
      .from("folders")
      .update({
        parent_id: newParentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", folderId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error moving folder:", error);
      throw new Error(`Failed to move folder: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in moveFolder:", error);
    throw error;
  }
};

/**
 * Check if moving a folder would create a circular reference
 */
async function wouldCreateCircularReference(
  userId: string,
  folderId: string,
  targetParentId: string,
): Promise<boolean> {
  let currentId = targetParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === folderId) return true;
    if (visited.has(currentId)) return true; // Already a circular reference
    visited.add(currentId);

    const { data, error } = await supabase
      .from("folders")
      .select("parent_id")
      .eq("id", currentId)
      .eq("user_id", userId)
      .single();

    if (error || !data) break;
    if (!data.parent_id) break;

    currentId = data.parent_id;
  }

  return false;
}

/**
 * Get all folders for a user
 */
export const getFolders = async (userId: string): Promise<Folder[]> => {
  try {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("name");

    if (error) {
      console.error("Error fetching folders:", error);
      throw new Error(`Failed to fetch folders: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getFolders:", error);
    throw error;
  }
};

/**
 * Build a folder tree structure including notes
 */
export const buildFolderTree = async (
  userId: string,
): Promise<(FolderStructure | NoteItem)[]> => {
  try {
    // Get all folders
    const folders = await getFolders(userId);

    // Get all notes with their folder assignments
    const { data: notes, error: notesError } = await supabase
      .from("note_metadata")
      .select("id, title, folder_id")
      .eq("user_id", userId);

    if (notesError) {
      console.error("Error fetching notes for folder tree:", notesError);
      throw new Error(`Failed to fetch notes: ${notesError.message}`);
    }

    // Create a map of folder ID to folder structure
    const folderMap: Record<string, FolderStructure> = {};

    // Initialize folder structures
    folders.forEach((folder) => {
      folderMap[folder.id] = {
        id: folder.id,
        name: folder.name,
        type: "folder",
        children: [],
        parentId: folder.parent_id,
      };
    });

    // Build the tree structure
    const rootItems: (FolderStructure | NoteItem)[] = [];

    // Add folders to their parents
    folders.forEach((folder) => {
      const folderStructure = folderMap[folder.id];

      if (folder.parent_id === null) {
        // Root folder
        rootItems.push(folderStructure);
      } else if (folderMap[folder.parent_id]) {
        // Add to parent folder
        folderMap[folder.parent_id].children.push(folderStructure);
      } else {
        // Parent folder not found, add to root
        folderStructure.parentId = null;
        rootItems.push(folderStructure);
      }
    });

    // Add notes to their folders or root
    notes?.forEach((note) => {
      const noteItem: NoteItem = {
        id: note.id,
        name: note.title,
        type: "note",
        parentId: note.folder_id,
      };

      if (note.folder_id === null) {
        // Root note
        rootItems.push(noteItem);
      } else if (folderMap[note.folder_id]) {
        // Add to folder
        folderMap[note.folder_id].children.push(noteItem);
      } else {
        // Folder not found, add to root
        noteItem.parentId = null;
        rootItems.push(noteItem);
      }
    });

    return rootItems;
  } catch (error) {
    console.error("Error in buildFolderTree:", error);
    throw error;
  }
};
