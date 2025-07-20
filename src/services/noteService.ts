/**
 * Note Service - CRUD operations for notes in the block-based system
 */

import { supabase } from "@/integrations/supabase/client";
import type { Note, NoteWithMetadata } from "@/types/blocks";
import { createBlock } from "./blockService";

/**
 * Create a new note
 */
export const createNote = async (
  title: string,
  folderId?: string | null,
  audioUrl?: string | null,
  duration?: number | null
): Promise<string> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    const noteData = {
      user_id: user.user.id,
      folder_id: folderId || null,
      title,
      audio_url: audioUrl || null,
      duration: duration || null,
    };

    const { data, error } = await supabase
      .from("notes_new")
      .insert(noteData)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating note:", error);
      throw new Error(`Failed to create note: ${error.message}`);
    }

    // Create initial title block
    await createBlock({
      note_id: data.id,
      type: "heading-1",
      position: 1,
      props: {
        text: title,
        level: 1
      }
    });

    return data.id;
  } catch (error) {
    console.error("Error in createNote:", error);
    throw error;
  }
};

/**
 * Get a note by ID
 */
export const getNote = async (noteId: string): Promise<Note | null> => {
  try {
    const { data, error } = await supabase
      .from("notes_new")
      .select("*")
      .eq("id", noteId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      console.error("Error fetching note:", error);
      throw new Error(`Failed to fetch note: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error in getNote:", error);
    throw error;
  }
};

/**
 * Get notes for a user with metadata
 */
export const getNotes = async (
  userId: string,
  folderId?: string | null
): Promise<NoteWithMetadata[]> => {
  try {
    let query = supabase
      .from("note_summaries")
      .select("*")
      .eq("user_id", userId);

    if (folderId !== undefined) {
      query = query.eq("folder_id", folderId);
    }

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      throw new Error(`Failed to fetch notes: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getNotes:", error);
    throw error;
  }
};

/**
 * Update a note
 */
export const updateNote = async (
  noteId: string,
  updates: {
    title?: string;
    folder_id?: string | null;
    audio_url?: string | null;
    duration?: number | null;
  }
): Promise<void> => {
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("notes_new")
      .update(updateData)
      .eq("id", noteId);

    if (error) {
      console.error("Error updating note:", error);
      throw new Error(`Failed to update note: ${error.message}`);
    }

    // If title is updated, update the title block too
    if (updates.title) {
      const { data: titleBlock } = await supabase
        .from("blocks")
        .select("id")
        .eq("note_id", noteId)
        .eq("type", "heading-1")
        .order("position")
        .limit(1)
        .single();

      if (titleBlock) {
        await supabase
          .from("blocks")
          .update({
            props: { text: updates.title, level: 1 },
            updated_at: new Date().toISOString()
          })
          .eq("id", titleBlock.id);
      }
    }
  } catch (error) {
    console.error("Error in updateNote:", error);
    throw error;
  }
};

/**
 * Delete a note and all its blocks
 */
export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    // Delete all blocks first (should cascade from note deletion, but explicit is safer)
    await supabase
      .from("blocks")
      .delete()
      .eq("note_id", noteId);

    // Delete the note
    const { error } = await supabase
      .from("notes_new")
      .delete()
      .eq("id", noteId);

    if (error) {
      console.error("Error deleting note:", error);
      throw new Error(`Failed to delete note: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in deleteNote:", error);
    throw error;
  }
};

/**
 * Move a note to a different folder
 */
export const moveNote = async (
  noteId: string,
  folderId: string | null
): Promise<void> => {
  try {
    await updateNote(noteId, { folder_id: folderId });
  } catch (error) {
    console.error("Error in moveNote:", error);
    throw error;
  }
};

/**
 * Duplicate a note with all its blocks
 */
export const duplicateNote = async (
  noteId: string,
  newTitle?: string
): Promise<string> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    // Get original note
    const originalNote = await getNote(noteId);
    if (!originalNote) throw new Error("Note not found");

    // Create new note
    const newNoteId = await createNote(
      newTitle || `${originalNote.title} (Copy)`,
      originalNote.folder_id,
      originalNote.audio_url,
      originalNote.duration
    );

    // Get all blocks from original note
    const { data: blocks, error } = await supabase
      .from("blocks")
      .select("*")
      .eq("note_id", noteId)
      .neq("type", "heading-1") // Skip title block as it's already created
      .order("position");

    if (error) throw error;

    // Duplicate blocks
    if (blocks && blocks.length > 0) {
      const newBlocks = blocks.map(block => ({
        user_id: user.user.id,
        note_id: newNoteId,
        parent_id: block.parent_id,
        position: block.position + 1, // Offset by 1 since title block is at position 1
        type: block.type,
        props: block.props,
        audio_timestamp: block.audio_timestamp,
        ai_generated: block.ai_generated,
      }));

      const { error: insertError } = await supabase
        .from("blocks")
        .insert(newBlocks);

      if (insertError) throw insertError;
    }

    return newNoteId;
  } catch (error) {
    console.error("Error in duplicateNote:", error);
    throw error;
  }
};

/**
 * Search notes by title and content
 */
export const searchNotes = async (
  query: string,
  userId: string,
  folderId?: string | null
): Promise<NoteWithMetadata[]> => {
  try {
    let queryBuilder = supabase
      .from("note_summaries")
      .select("*")
      .eq("user_id", userId)
      .or(`title.ilike.%${query}%,preview.ilike.%${query}%`);

    if (folderId !== undefined) {
      queryBuilder = queryBuilder.eq("folder_id", folderId);
    }

    const { data, error } = await queryBuilder
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error searching notes:", error);
      throw new Error(`Failed to search notes: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in searchNotes:", error);
    throw error;
  }
};

/**
 * Get recent notes for a user
 */
export const getRecentNotes = async (
  userId: string,
  limit: number = 10
): Promise<NoteWithMetadata[]> => {
  try {
    const { data, error } = await supabase
      .from("note_summaries")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent notes:", error);
      throw new Error(`Failed to fetch recent notes: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getRecentNotes:", error);
    throw error;
  }
};

/**
 * Get notes in a folder with pagination
 */
export const getNotesInFolder = async (
  folderId: string | null,
  userId: string,
  offset: number = 0,
  limit: number = 20
): Promise<{ notes: NoteWithMetadata[]; total: number }> => {
  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from("notes_new")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("folder_id", folderId);

    if (countError) throw countError;

    // Get notes with pagination
    const { data, error } = await supabase
      .from("note_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching notes in folder:", error);
      throw new Error(`Failed to fetch notes: ${error.message}`);
    }

    return {
      notes: data || [],
      total: count || 0
    };
  } catch (error) {
    console.error("Error in getNotesInFolder:", error);
    throw error;
  }
};

/**
 * Update note metadata (called by triggers, but can be called manually)
 */
export const updateNoteMetadata = async (noteId: string): Promise<void> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    // Count blocks
    const { count } = await supabase
      .from("blocks")
      .select("*", { count: "exact", head: true })
      .eq("note_id", noteId);

    // Get latest block update
    const { data: latestBlock } = await supabase
      .from("blocks")
      .select("updated_at")
      .eq("note_id", noteId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    // Update note metadata
    await supabase
      .from("notes_new")
      .update({
        block_count: count || 0,
        last_edit_by: user.user.id,
        updated_at: latestBlock?.updated_at || new Date().toISOString()
      })
      .eq("id", noteId);
  } catch (error) {
    console.error("Error in updateNoteMetadata:", error);
    // Don't throw - this is called from triggers
  }
};