import { supabase } from "@/integrations/supabase/client";
import { CreateBlockRequest } from "@/types/blocks";
import { createBlocksBatch } from "./blockService";

interface CreateBlockNoteOptions {
  title: string;
  folderId?: string | null;
  audioUrl?: string | null;
  duration?: number | null;
}

/**
 * Create a new note using the block-based architecture
 */
export const createBlockNote = async (
  userId: string,
  options: CreateBlockNoteOptions
): Promise<string> => {
  try {
    // Create the note in notes_new table
    const { data: noteData, error: noteError } = await supabase
      .from("notes_new")
      .insert({
        user_id: userId,
        title: options.title,
        folder_id: options.folderId || null,
        audio_url: options.audioUrl || null,
        duration: options.duration || null,
        block_count: 0,
      })
      .select("id")
      .single();

    if (noteError) throw noteError;

    const noteId = noteData.id;

    // Create initial blocks
    const initialBlocks: CreateBlockRequest[] = [
      {
        note_id: noteId,
        type: "heading-1",
        props: {
          text: options.title,
          level: 1,
        },
        position: 1,
      },
      {
        note_id: noteId,
        type: "text",
        props: {
          text: "",
        },
        position: 2,
      },
    ];

    await createBlocksBatch(initialBlocks);

    // Also create in the old note_metadata table for compatibility
    await supabase
      .from("note_metadata")
      .insert({
        id: noteId,
        user_id: userId,
        title: options.title,
        folder_id: options.folderId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    return noteId;
  } catch (error) {
    console.error("Error creating block note:", error);
    throw error;
  }
};

/**
 * Update note title in both old and new tables
 */
export const updateBlockNoteTitle = async (
  userId: string,
  noteId: string,
  newTitle: string
): Promise<void> => {
  try {
    // Update in notes_new table
    const { error: newError } = await supabase
      .from("notes_new")
      .update({ title: newTitle })
      .eq("id", noteId)
      .eq("user_id", userId);

    if (newError) throw newError;

    // Update in old table
    await supabase
      .from("note_metadata")
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .eq("user_id", userId);

    // Update the title block if it exists
    const { data: titleBlock } = await supabase
      .from("blocks")
      .select("id")
      .eq("note_id", noteId)
      .eq("type", "heading-1")
      .eq("position", 1)
      .single();

    if (titleBlock) {
      await supabase
        .from("blocks")
        .update({
          props: { text: newTitle, level: 1 },
          updated_at: new Date().toISOString(),
        })
        .eq("id", titleBlock.id);
    }
  } catch (error) {
    console.error("Error updating block note title:", error);
    throw error;
  }
};

/**
 * Delete a block-based note and all associated data
 */
export const deleteBlockNote = async (
  userId: string,
  noteId: string
): Promise<void> => {
  try {
    // Delete from notes_new (blocks will cascade delete)
    const { error: newError } = await supabase
      .from("notes_new")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);

    if (newError) throw newError;

    // Delete from old tables
    await supabase
      .from("note_metadata")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);

    // Delete any associated storage files
    const { data: noteData } = await supabase
      .from("note_metadata")
      .select("audio_url")
      .eq("id", noteId)
      .single();

    if (noteData?.audio_url) {
      const audioPath = noteData.audio_url.split("/").pop();
      if (audioPath) {
        await supabase.storage.from("audio").remove([`${userId}/${audioPath}`]);
      }
    }
  } catch (error) {
    console.error("Error deleting block note:", error);
    throw error;
  }
};