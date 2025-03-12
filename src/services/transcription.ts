import { createClient } from "@supabase/supabase-js";
import { saveNote } from "./noteStorage";

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase URL or Anon Key are not defined in environment variables.",
  );
}

const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);

// Process audio to get both transcription and summary
export const processAudioWithSummary = async (
  audioFile: File,
  userId: string,
  metadata: any,
): Promise<{ transcription: string; summary: string; noteId: string }> => {
  console.log("processAudioWithSummary: Start");
  console.log("processAudioWithSummary: userId received:", userId);
  try {
    // Process the audio using Supabase
    const { transcription, summary, fileUrl } =
      await processAudioInSupabase(audioFile); // Include fileUrl in return

    // Parse structured summary if it's a string
    let structuredSummary = null;
    try {
      // Try to parse the summary as JSON to extract structured data
      const summaryLines = summary.split("\n");
      const jsonStart = summaryLines.findIndex((line) =>
        line.trim().startsWith("{"),
      );
      const jsonEnd = summaryLines.findIndex((line) =>
        line.trim().endsWith("}"),
      );

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
        const jsonString = summaryLines
          .slice(jsonStart, jsonEnd + 1)
          .join("\n");
        structuredSummary = JSON.parse(jsonString);
      }
    } catch (parseError) {
      console.log("Could not parse structured summary, using raw summary");
    }

    // Save the note to bucket storage
    const noteId = await saveNote(userId, {
      title: metadata.title,
      transcription,
      summary,
      structuredSummary,
      audioUrl: fileUrl,
    });

    console.log("processAudioWithSummary: Note saved with ID:", noteId);

    return {
      transcription,
      summary,
      noteId,
    };
  } catch (error) {
    console.error("processAudioWithSummary: Error -", error);
    throw new Error("Failed to process audio");
  } finally {
    console.log("processAudioWithSummary: Finally");
  }
};

// Fixed to match how it's used in AudioUploader
export const transcribeAudio = async (
  audioFile: File,
): Promise<{ text: string }> => {
  console.log("transcribeAudio: Start");
  try {
    // Upload to Supabase storage and get transcription
    const { transcription } = await processAudioInSupabase(audioFile);
    return { text: transcription };
  } catch (error) {
    console.error("transcribeAudio: Error -", error);
    throw new Error("Failed to transcribe audio");
  } finally {
    console.log("transcribeAudio: Finally");
  }
};

// Function to summarize text transcription
export const summarizeTranscription = async (text: string) => {
  console.log("summarizeTranscription: Start");
  try {
    // Call the Supabase function with the text
    const { data, error } = await supabase.functions.invoke("summarize-audio", {
      body: { audioText: text },
    });

    if (error) {
      console.error("summarizeTranscription: Supabase Function error -", error);
      throw new Error("Failed to summarize transcription");
    }

    return {
      transcription: text,
      summary: data.summary,
    };
  } catch (error) {
    console.error("summarizeTranscription: Error -", error);
    throw new Error("Failed to summarize transcription");
  } finally {
    console.log("summarizeTranscription: Finally");
  }
};

// Helper function to process audio in Supabase
export async function processAudioInSupabase(
  audioFile: File,
): Promise<{ transcription: string; summary: string; fileUrl: string }> {
  console.log("processAudioInSupabase: Start");
  // Validate the audio file
  if (!audioFile || !audioFile.size) {
    console.error("processAudioInSupabase: Invalid audio file");
    throw new Error("Invalid or empty audio file");
  }

  console.log("Processing audio file:", {
    name: audioFile.name,
    type: audioFile.type,
    size: audioFile.size,
    lastModified: new Date(audioFile.lastModified).toISOString(),
  });

  // Check if file type is supported
  const supportedTypes = [
    "audio/wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm",
  ];
  let contentType = audioFile.type;

  // If type is not explicitly supported, try to determine from extension
  if (!supportedTypes.includes(contentType)) {
    const extension = audioFile.name.split(".").pop()?.toLowerCase() || "";
    switch (extension) {
      case "wav":
      case "wave":
        contentType = "audio/wav";
        break;
      case "mp3":
      case "mpeg":
        contentType = "audio/mpeg";
        break;
      case "m4a":
        contentType = "audio/x-m4a";
        break;
      case "mp4":
        contentType = "audio/mp4";
        break;
      case "webm":
        contentType = "audio/webm";
        break;
      default:
        throw new Error(
          `Unsupported file type: ${extension}. Please use WAV, MP3, M4A, or WebM files.`,
        );
    }
    console.log(
      `Determined content type ${contentType} based on extension ${extension}`,
    );
  }

  // Generate a unique filename with original extension
  const fileExtension = audioFile.name.split(".").pop()?.toLowerCase() || "wav";
  const filename = `audio_${Date.now()}.${fileExtension}`;
  const filePath = `temp_audio/${filename}`;

  console.log(
    `Uploading file to Supabase storage: ${filePath} (${contentType})`,
  );

  let publicUrl = ""; // Declare publicUrl here

  try {
    // 1. Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("audio_uploads")
      .upload(filePath, audioFile, {
        contentType: contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "processAudioInSupabase: Storage Upload Error -",
        uploadError,
      );
      throw new Error(`Failed to upload audio file: ${uploadError.message}`);
    }

    console.log("File uploaded successfully:", uploadData);

    // 2. Get a public URL for the file
    const { data: urlData } = supabase.storage
      .from("audio_uploads")
      .getPublicUrl(filePath);

    publicUrl = urlData.publicUrl; // Assign value to the declared publicUrl
    console.log("Generated public URL:", publicUrl);

    // Verify the uploaded file is accessible
    try {
      const response = await fetch(publicUrl, { method: "HEAD" });
      if (!response.ok) {
        console.error(
          "processAudioInSupabase: File Verification Error - HTTP Status",
          response.status,
        );
        throw new Error(
          `Failed to verify uploaded file: HTTP ${response.status}`,
        );
      }
      console.log("Verified uploaded file is accessible:", {
        status: response.status,
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
      });
    } catch (verifyError) {
      console.error(
        "processAudioInSupabase: File Verification Fetch Error -",
        verifyError,
      );
      // Continue anyway, as the file might still be processable
    }

    // 3. Call the Supabase function with the file URL and metadata
    console.log("Calling Supabase function for audio processing");
    const { data, error } = await supabase.functions.invoke("summarize-audio", {
      body: {
        audioUrl: publicUrl,
        contentType: contentType,
        fileName: filename,
      },
    });

    if (error) {
      console.error(
        "processAudioInSupabase: Supabase Function Invoke Error -",
        error,
      );
      throw new Error(`Failed to process audio: ${error.message}`);
    }

    if (
      !data ||
      !data.transcription ||
      data.transcription.trim().length === 0
    ) {
      console.error("processAudioInSupabase: No transcription in response");
      throw new Error("No transcription received from processing service");
    }

    console.log("Audio processing successful:", {
      transcriptionLength: data.transcription.length,
      summaryLength: data.summary?.length || 0,
    });

    // 4. Clean up the uploaded file
    try {
      await supabase.storage.from("audio_uploads").remove([filePath]);
      console.log("Temporary audio file removed from storage");
    } catch (cleanupError) {
      console.warn(
        "processAudioInSupabase: File Cleanup Error -",
        cleanupError,
      );
      // Don't throw on cleanup errors
    }

    return {
      transcription: data.transcription,
      summary: data.summary || "",
      fileUrl: publicUrl,
    };
  } catch (error) {
    console.error("processAudioInSupabase: General Error -", error);
    // Clean up on error
    try {
      await supabase.storage.from("audio_uploads").remove([filePath]);
    } catch (cleanupError) {
      console.warn(
        "processAudioInSupabase: Cleanup After Error -",
        cleanupError,
      );
    }

    // Enhance error message for user-friendly display
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Audio processing failed: ${errorMessage}`);
  } finally {
    console.log("processAudioInSupabase: Finally");
  }
}

import {
  listNotes as listNotesFromBucket,
  getNote as getNoteFromBucket,
} from "./noteStorage";

// Function to fetch notes for a user
export const fetchNotes = async (userId: string) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Get notes from bucket storage
    const notes = await listNotesFromBucket(userId);

    // Format notes to match the expected structure in the app
    return notes.map((note) => ({
      id: note.id,
      title: note.title,
      created_at: note.created_at,
      updated_at: note.updated_at,
      preview: note.preview,
      audio_url: note.audio_path
        ? supabase.storage.from("notes").getPublicUrl(note.audio_path).data
            .publicUrl
        : null,
    }));
  } catch (error) {
    console.error("Error fetching notes:", error);
    throw new Error("Failed to fetch notes");
  }
};

// Function to fetch a single note by ID
export const fetchNoteById = async (userId: string, noteId: string) => {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Get note from bucket storage
    const note = await getNoteFromBucket(userId, noteId);

    // Format note to match the expected structure in the app
    return {
      id: note.id,
      title: note.title,
      content: note.transcription,
      transcription: note.transcription,
      raw_summary: note.summary,
      structured_summary: note.structuredSummary,
      audio_url: note.audioUrl,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching note by ID:", error);
    throw new Error(`Failed to fetch note by ID ${noteId}`);
  }
};
