import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    // Initialize Gemini API client
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Use gemini-2.0-flash model which supports audio and text
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let { audioText, audioUrl } = await req.json();
    
    let transcription = "";
    let summaryContent = "";

    // CASE 1: Process audio file if URL is provided
    if (audioUrl) {
      console.log('Processing audio file from URL:', audioUrl);
      
      // Download the audio file
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio file: ${audioResponse.statusText}`);
      }
      
      const audioBlob = await audioResponse.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Convert to base64
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
      
      // Get the mime type or default to audio/wav
      const mimeType = audioBlob.type || 'audio/wav';
      
      console.log(`Audio file downloaded. Size: ${arrayBuffer.byteLength} bytes, Type: ${mimeType}`);
      
      // Use Gemini to transcribe the audio and generate initial summary
      const transcribeResult = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { 
                inline_data: { 
                  mime_type: mimeType,
                  data: base64Audio 
                }
              },
              { 
                text: `You are an expert in creating lecture notes from audio transcriptions.

                Please transcribe the audio file and provide a concise summary highlighting the key points.
                Include the following:
                1. The full transcription text
                2. A structured set of lecture notes in markdown format
                3. A concise summary (1-2 paragraphs)
                4. A list of key points as bullet points
                                  
                Return your response as a valid JSON object with the following structure:
                {
                  "transcription": "the complete transcription text",
                  "notes": "well-structured lecture notes in markdown format with ## section headers and ### subsection headers",
                  "summary": "a concise 1-2 paragraph summary of the main topics",
                  "keyPoints": ["key point 1", "key point 2", "key point 3", ...]
                }

                For the notes, use proper markdown formatting:
                - ## for section headers 
                - ### for subsection headers
                - *italic* for technical terms
                - **bold** for important concepts
                - Bullet points for lists

                Ensure the JSON is valid and properly formatted.
                `
              }
            ]
          }
        ]
      });

      const responseText = await transcribeResult.response.text();
      console.log('Gemini transcription response received');
      
      try {
        // Try to parse the response as JSON
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
        const jsonContent = jsonMatch ? (jsonMatch[1] || jsonMatch[2]) : responseText;
        
        const parsedResponse = JSON.parse(jsonContent);
        
        if (parsedResponse.transcription) {
          transcription = parsedResponse.transcription;
          summaryContent = parsedResponse.notes || '';
          let notes = parsedResponse.notes || '';
          let keyPoints = parsedResponse.keyPoints || [];
          audioText = transcription;
        } else {
          // Fallback to regex extraction
          transcription = extractTranscription(responseText);
          summaryContent = extractSummary(responseText);
          audioText = transcription;
        }
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        // Fallback to regex extraction
        transcription = extractTranscription(responseText);
        summaryContent = extractSummary(responseText);
        audioText = transcription;
      }
    }
    

  

    // Create structured summary from markdown
    const structuredSummary = {
      summary: '',
      keyPoints: [],
      sections: []
    };
    
    // Parse the markdown content
    const paragraphs = summaryContent.split('\n\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length > 0) {
      // First non-header paragraph is the summary
      structuredSummary.summary = paragraphs.find(p => !p.startsWith('#')) || '';
      
      // Extract key points (bullet points)
      const keyPointsSection = paragraphs.find(p => p.toLowerCase().includes('key points') || p.toLowerCase().includes('main points'));
      if (keyPointsSection) {
        const points = keyPointsSection
          .split('\n')
          .filter(line => line.trim().startsWith('*') || line.trim().startsWith('-'))
          .map(point => point.replace(/^[*-]\s*/, '').trim());
        structuredSummary.keyPoints = points;
      }
      
      // Parse sections and subsections
      let currentSection = null;
      let currentSubsection = null;
      
      paragraphs.forEach(paragraph => {
        // Check for section headers (##)
        if (paragraph.startsWith('## ')) {
          currentSection = {
            title: paragraph.replace(/^##\s*/, ''),
            content: '',
            subsections: []
          };
          structuredSummary.sections.push(currentSection);
          currentSubsection = null;
        }
        // Check for subsection headers (###)
        else if (paragraph.startsWith('### ') && currentSection) {
          currentSubsection = {
            title: paragraph.replace(/^###\s*/, ''),
            content: ''
          };
          currentSection.subsections.push(currentSubsection);
        }
        // Add content to current section or subsection
        else if (currentSection) {
          if (currentSubsection) {
            currentSubsection.content += paragraph + '\n\n';
          } else {
            currentSection.content += paragraph + '\n\n';
          }
        }
      });
    }

    return new Response(JSON.stringify({ 
      transcription,
      summary: summaryContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in summarize-audio function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions to extract transcription and summary from Gemini response
function extractTranscription(text: string): string {
  const match = text.match(/TRANSCRIPTION:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
  return match ? match[1].trim() : '';
}

function extractSummary(text: string): string {
  const match = text.match(/SUMMARY:\s*([\s\S]*)/i);
  return match ? match[1].trim() : '';
}
