import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CaptionsRequest {
  videoId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json() as CaptionsRequest;

    if (!videoId) {
      throw new Error("Missing video ID");
    }

    // For now, return empty captions
    // In a full implementation, this would:
    // 1. Use YouTube API or scraping to get captions
    // 2. Parse and format caption data
    // 3. Return structured caption objects

    const captions = [
      {
        text: "This is a placeholder caption.",
        start: 0,
        duration: 5,
      },
      {
        text: "YouTube caption extraction will be implemented here.",
        start: 5,
        duration: 5,
      },
    ];

    return new Response(
      JSON.stringify({ 
        success: true,
        captions,
        hasAutoCaptions: false,
        language: "en",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in youtube-captions:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to fetch captions",
        captions: [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 even on error to not break the flow
      }
    );
  }
});