import { supabase } from "@/integrations/supabase/client";
import { saveNote, NoteData } from "./noteStorage";

/**
 * Migrate notes from database table to storage bucket
 */
export const migrateNotesToBucket = async (
  userId: string,
): Promise<{ success: boolean; count: number; errors: string[] }> => {
  try {
    console.log(`Starting migration for user ${userId}`);
    const errors: string[] = [];
    let migratedCount = 0;

    // Fetch all notes from the database table
    const { data: notes, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching notes for migration:", error);
      throw new Error(`Failed to fetch notes: ${error.message}`);
    }

    if (!notes || notes.length === 0) {
      console.log("No notes found to migrate");
      return { success: true, count: 0, errors };
    }

    console.log(`Found ${notes.length} notes to migrate`);

    // Process each note
    for (const note of notes) {
      try {
        // Prepare note data for bucket storage
        const noteData: NoteData = {
          id: note.id,
          title: note.title || "Untitled Note",
          transcription: note.transcription || "", // Use transcription directly
          summary: note.raw_summary || "",
          structuredSummary: note.structured_summary,
          audioUrl: note.audio_url,
          createdAt: new Date(note.created_at),
          updatedAt: new Date(),
        };

        // Save to bucket storage
        await saveNote(userId, noteData);
        migratedCount++;
        console.log(`Migrated note ${note.id}`);
      } catch (noteError: any) {
        console.error(`Error migrating note ${note.id}:`, noteError);
        errors.push(`Note ${note.id}: ${noteError.message}`);
      }
    }

    return {
      success: errors.length === 0,
      count: migratedCount,
      errors,
    };
  } catch (error: any) {
    console.error("Error in migrateNotesToBucket:", error);
    return {
      success: false,
      count: 0,
      errors: [error.message],
    };
  }
};
