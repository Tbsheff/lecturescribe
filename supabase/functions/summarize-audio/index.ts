import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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

    const { audioText } = await req.json();
    
    if (!audioText) {
      throw new Error('Audio text is required');
    }

    console.log('Received audio text for summarization');
    
    // Call Gemini API to generate a summary
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert in creating lecture notes from audio transcriptions. 
                Your task is to create well-structured, comprehensive notes from the following lecture transcript.
                
                Follow these guidelines:
                1. Create a concise summary of the main topics covered
                2. Identify and list key points and main ideas
                3. Create a logical structure with sections and subsections
                4. Include any important definitions, concepts, or examples
                5. Format the notes in a clean, readable way
                
                Here is the transcript:
                ${audioText}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API error:', data);
      throw new Error(`Gemini API error: ${data.error?.message || 'Unknown error'}`);
    }

    const summaryText = data.candidates[0]?.content?.parts[0]?.text || '';
    
    // Create structured summary
    const structuredSummary = {
      summary: '', // First paragraph of the summary
      keyPoints: [], // Bullet points of key takeaways
      sections: [] // Detailed content
    };
    
    // Very basic parsing of the generated text
    const paragraphs = summaryText.split('\n\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length > 0) {
      // First paragraph is usually a good summary
      structuredSummary.summary = paragraphs[0];
      
      // Look for sections and key points
      let currentSection = null;
      
      paragraphs.forEach(paragraph => {
        // Try to identify key points (often start with bullet points, numbers, or specific keywords)
        if (paragraph.includes('• ') || paragraph.includes('* ') || paragraph.match(/^\d+\./)) {
          const points = paragraph.split(/\n[•*]\s|\n\d+\.\s/).filter(p => p.trim().length > 0);
          structuredSummary.keyPoints.push(...points);
        }
        // Try to identify sections (usually headers that are short and end with a colon)
        else if (paragraph.length < 100 && (paragraph.includes(':') || paragraph.toUpperCase() === paragraph)) {
          currentSection = {
            title: paragraph.replace(':', ''),
            content: '',
            subsections: []
          };
          structuredSummary.sections.push(currentSection);
        }
        // Add content to current section
        else if (currentSection) {
          // Check if this might be a subsection
          if (paragraph.length < 80 && paragraph.includes(':')) {
            currentSection.subsections.push({
              title: paragraph.replace(':', ''),
              content: ''
            });
          } 
          // Otherwise add to current subsection or main section
          else if (currentSection.subsections.length > 0) {
            const lastSubsection = currentSection.subsections[currentSection.subsections.length - 1];
            lastSubsection.content += paragraph + ' ';
          } else {
            currentSection.content += paragraph + ' ';
          }
        }
      });
    }

    return new Response(JSON.stringify({ 
      rawSummary: summaryText,
      structuredSummary
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
