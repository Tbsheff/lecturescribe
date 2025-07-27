import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessVideoRequest {
  noteId: string;
  videoId: string;
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { noteId, videoId, userId } = await req.json() as ProcessVideoRequest;

    if (!noteId || !videoId || !userId) {
      throw new Error("Missing required parameters");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For now, we'll create placeholder blocks
    // In a full implementation, this would:
    // 1. Extract audio from YouTube video
    // 2. Send to transcription service
    // 3. Extract captions if available
    // 4. Create structured blocks

    const blocks = [
      {
        user_id: userId,
        note_id: noteId,
        type: "heading-1",
        props: { text: "Video Transcript", level: 1 },
        position: 1,
        ai_generated: false,
      },
      {
        user_id: userId,
        note_id: noteId,
        type: "text",
        props: { 
          text: "Video processing is in progress. This feature will extract audio from the YouTube video and generate a transcript with timestamps." 
        },
        position: 2,
        ai_generated: false,
      },
      {
        user_id: userId,
        note_id: noteId,
        type: "divider",
        props: { style: "line" },
        position: 3,
      },
      {
        user_id: userId,
        note_id: noteId,
        type: "heading-2",
        props: { text: "Video Information", level: 2 },
        position: 4,
      },
      {
        user_id: userId,
        note_id: noteId,
        type: "text",
        props: { text: `Video ID: ${videoId}` },
        position: 5,
      },
      {
        user_id: userId,
        note_id: noteId,
        type: "text",
        props: { 
          text: "Full transcription with timestamps will appear here once processing is complete." 
        },
        position: 6,
        ai_generated: true,
      },
    ];

    // Insert blocks
    const { error: blocksError } = await supabase
      .from("blocks")
      .insert(blocks);

    if (blocksError) {
      console.error("Error inserting blocks:", blocksError);
      throw new Error("Failed to create content blocks");
    }

    // Update note to indicate processing is complete (for demo)
    const { error: updateError } = await supabase
      .from("notes_new")
      .update({ 
        block_count: blocks.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId);

    if (updateError) {
      console.error("Error updating note:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Video processing initiated",
        blocksCreated: blocks.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in process-youtube-video:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to process video",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});