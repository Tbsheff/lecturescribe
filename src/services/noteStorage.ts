import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Interface for note data
export interface NoteData {
  id?: string;
  title: string;
  transcription: string;
  summary: string;
  structuredSummary?: any;
  audioUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  folderId?: string | null;
}

// Interface for note metadata
export interface NoteMetadata {
  id: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
  audio_path?: string;
  note_path: string;
  folder_id?: string | null;
}

/**
 * Save a note to Supabase storage bucket
 */
export const saveNote = async (
  userId: string,
  noteData: NoteData,
): Promise<string> => {
  try {
    console.log("Saving note to bucket storage");

    // Generate a unique ID for the note if not provided
    const noteId = noteData.id || uuidv4();

    // Create paths for storing files
    const userFolder = `${userId}`;
    const notePath = `${userFolder}/${noteId}/note.json`;
    let audioPath = null;

    // Prepare the note data
    const noteContent = {
      id: noteId,
      title: noteData.title,
      transcription: noteData.transcription, // Ensure transcription is saved
      summary: noteData.summary,
      structuredSummary: noteData.structuredSummary || null,
      createdAt: noteData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderId: noteData.folderId
    };

    // Convert note data to JSON string
    const noteJson = JSON.stringify(noteContent, null, 2);

    // Upload note JSON to the notes bucket
    const { error: noteUploadError } = await supabase.storage
      .from("notes")
      .upload(notePath, noteJson, {
        contentType: "application/json",
        upsert: true,
      });

    if (noteUploadError) {
      console.error("Error uploading note JSON:", noteUploadError);
      throw new Error(`Failed to upload note: ${noteUploadError.message}`);
    }

    // If there's an audio URL, store the path reference and copy to bucket if needed
    if (noteData.audioUrl) {
      const fileExtension = getFileExtension(noteData.audioUrl);
      audioPath = `${userFolder}/${noteId}/audio${fileExtension}`;

      // Check if we need to copy the file to our bucket
      if (noteData.audioUrl.includes("audio_uploads")) {
        try {
          // Download the file from the temporary location
          const response = await fetch(noteData.audioUrl);
          if (!response.ok)
            throw new Error(`Failed to fetch audio: ${response.status}`);

          const audioBlob = await response.blob();

          // Upload to permanent storage in notes bucket
          const { error: audioUploadError } = await supabase.storage
            .from("notes")
            .upload(audioPath, audioBlob, {
              contentType: audioBlob.type,
              upsert: true,
            });

          if (audioUploadError) {
            console.error(
              "Error copying audio to permanent storage:",
              audioUploadError,
            );
          } else {
            console.log("Audio file copied to permanent storage at", audioPath);
          }
        } catch (audioError) {
          console.error("Error processing audio file:", audioError);
          // Continue with saving the note even if audio processing fails
        }
      }
    }

    // Create or update metadata record for quick listing
    const { error: metadataError } = await supabase
      .from("note_metadata")
      .upsert({
        id: noteId,
        user_id: userId,
        title: noteData.title,
        note_path: notePath,
        audio_path: audioPath,
        audio_bucket_path: audioPath,
        preview: noteData.summary?.substring(0, 150) || "No summary available",
        updated_at: new Date().toISOString(),
        folder_id: noteData.folderId
      });

    if (metadataError) {
      console.error("Error saving note metadata:", metadataError);
      throw new Error(`Failed to save note metadata: ${metadataError.message}`);
    }

    return noteId;
  } catch (error) {
    console.error("Error in saveNote:", error);
    throw error;
  }
};

/**
 * Get a note from Supabase storage bucket
 */
export const getNote = async (
  noteId: string,
): Promise<NoteData> => {
  try {
    const { data: user, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error fetching user:", userError);
      throw new Error("User not authenticated");
    }
    
    const userId = user.user.id;
    console.log(`Getting note ${noteId} for user ${userId}`);

    // Construct the path to the note JSON file
    const notePath = `${userId}/${noteId}/note.json`;

    // Download the note JSON file
    const { data: noteData, error: noteError } = await supabase.storage
      .from("notes")
      .download(notePath);

    if (noteError) {
      console.error("Error downloading note:", noteError);
      throw new Error(`Failed to download note: ${noteError.message}`);
    }

    // Parse the JSON data
    const noteText = await noteData.text();
    const note = JSON.parse(noteText);

    // Get metadata to check if there's an audio file
    const { data: metadata, error: metadataError } = await supabase
      .from("note_metadata")
      .select("audio_path, audio_bucket_path")
      .eq("id", noteId)
      .single();

    if (metadataError && metadataError.code !== "PGRST116") {
      // Ignore not found error
      console.error("Error fetching note metadata:", metadataError);
    }

    // If there's an audio file, get its public URL
    let audioUrl = null;
    if (metadata?.audio_bucket_path) {
      // Prefer the bucket path if available
      const { data: urlData } = supabase.storage
        .from("notes")
        .getPublicUrl(metadata.audio_bucket_path);

      audioUrl = urlData.publicUrl;
    } else if (metadata?.audio_path) {
      // Fall back to the original audio_path if it's a full URL
      if (metadata.audio_path.startsWith("http")) {
        audioUrl = metadata.audio_path;
      } else {
        // Try to get from storage if it's a path
        const { data: urlData } = supabase.storage
          .from("notes")
          .getPublicUrl(metadata.audio_path);

        audioUrl = urlData.publicUrl;
      }
    }

    // Return the note data with the audio URL if available
    return {
      ...note,
      audioUrl,
    };
  } catch (error) {
    console.error("Error in getNote:", error);
    throw error;
  }
};

/**
 * List all notes for a user
 */
export const listNotes = async (userId: string): Promise<NoteMetadata[]> => {
  try {
    console.log(`Listing notes for user ${userId}`);

    // Query the metadata table for quick listing
    const { data, error } = await supabase
      .from("note_metadata")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing notes:", error);
      throw new Error(`Failed to list notes: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in listNotes:", error);
    throw error;
  }
};

/**
 * Delete a note and its associated files
 */
export const deleteNote = async (
  userId: string,
  noteId: string,
): Promise<void> => {
  try {
    console.log(`Deleting note ${noteId} for user ${userId}`);

    // Get the note metadata to find associated files
    const { data: metadata, error: metadataError } = await supabase
      .from("note_metadata")
      .select("note_path, audio_path")
      .eq("id", noteId)
      .single();

    if (metadataError) {
      console.error(
        "Error fetching note metadata for deletion:",
        metadataError,
      );
      throw new Error(
        `Failed to fetch note metadata: ${metadataError.message}`,
      );
    }

    // Delete the note folder and all its contents
    const folderPath = `${userId}/${noteId}`;
    const { data: filesList, error: listError } = await supabase.storage
      .from("notes")
      .list(folderPath);

    if (listError) {
      console.error("Error listing files for deletion:", listError);
    } else if (filesList && filesList.length > 0) {
      // Delete all files in the folder
      const filesToDelete = filesList.map(
        (file) => `${folderPath}/${file.name}`,
      );
      const { error: deleteFilesError } = await supabase.storage
        .from("notes")
        .remove(filesToDelete);

      if (deleteFilesError) {
        console.error("Error deleting note files:", deleteFilesError);
      }
    }

    // Delete the metadata record
    const { error: deleteMetadataError } = await supabase
      .from("note_metadata")
      .delete()
      .eq("id", noteId);

    if (deleteMetadataError) {
      console.error("Error deleting note metadata:", deleteMetadataError);
      throw new Error(
        `Failed to delete note metadata: ${deleteMetadataError.message}`,
      );
    }
  } catch (error) {
    console.error("Error in deleteNote:", error);
    throw error;
  }
};

/**
 * Update a note's title
 */
export const updateNoteTitle = async (
  userId: string,
  noteId: string,
  newTitle: string,
): Promise<void> => {
  try {
    console.log(`Updating title for note ${noteId}`);

    // Get the current note data
    const note = await getNote(userId, noteId);

    // Update the title
    note.title = newTitle;

    // Save the updated note
    await saveNote(userId, note);

    // Update just the title in the metadata table for efficiency
    const { error: updateError } = await supabase
      .from("note_metadata")
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq("id", noteId);

    if (updateError) {
      console.error("Error updating note title in metadata:", updateError);
      throw new Error(`Failed to update note title: ${updateError.message}`);
    }
  } catch (error) {
    console.error("Error in updateNoteTitle:", error);
    throw error;
  }
};

/**
 * Update a note's content
 */
export const updateNoteContent = async (
  userId: string,
  noteId: string,
  content: string,
): Promise<void> => {
  try {
    console.log(`Updating content for note ${noteId}`);

    // Get the current note data
    const note = await getNote(userId, noteId);

    // Update the content
    note.transcription = content;

    // Save the updated note
    await saveNote(userId, note);
  } catch (error) {
    console.error("Error in updateNoteContent:", error);
    throw error;
  }
};

/**
 * Create a new empty note
 */
export const createEmptyNote = async (
  userId: string,
  title: string,
  folderId: string | null = null,
): Promise<string> => {
  try {
    console.log(`Creating new empty note: ${title}`);

    // Create a new note with empty content
    const noteId = await saveNote(userId, {
      title,
      transcription: "",
      summary: "No content yet",
      structuredSummary: null,
      folderId
    });

    // If a folder ID is provided, assign the note to that folder
    if (folderId) {
      const { error } = await supabase
        .from("note_metadata")
        .update({ folder_id: folderId })
        .eq("id", noteId);

      if (error) {
        console.error("Error assigning note to folder:", error);
      }
    }

    return noteId;
  } catch (error) {
    console.error("Error in createEmptyNote:", error);
    throw error;
  }
};

/**
 * Helper function to get file extension from URL
 */
function getFileExtension(url: string): string {
  const filename = url.split("/").pop() || "";
  const extension = filename.includes(".")
    ? `.${filename.split(".").pop()}`
    : "";
  return extension;
}
