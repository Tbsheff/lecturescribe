import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default empty response to ensure we never return sample text
const EMPTY_RESPONSE = {
  transcription: "",
  summary: ""
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

    let { audioText, audioUrl, contentType: providedContentType, fileName } = await req.json();
    
    let transcription = "";
    let summaryContent = "";

    // CASE 1: Process audio file if URL is provided
    if (audioUrl) {
      console.log(`Processing audio file from URL: ${audioUrl}`);
      if (fileName) console.log(`File name: ${fileName}`);
      if (providedContentType) console.log(`Content type provided by client: ${providedContentType}`);
      
      try {
        // Download the audio file
        console.log('Attempting to download audio file...');
        const audioResponse = await fetch(audioUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!audioResponse.ok) {
          console.error(`Failed to download audio file: Status ${audioResponse.status} - ${audioResponse.statusText}`);
          throw new Error(`Failed to download audio file: ${audioResponse.statusText} (${audioResponse.status})`);
        }
        
        console.log('Audio download successful. Response status:', audioResponse.status);
        console.log('Response Content-Type:', audioResponse.headers.get('content-type'));
        console.log('Response Content-Length:', audioResponse.headers.get('content-length'));
        
        // Ensure we have a blob with the proper content type
        // Use the client-provided content type if available, otherwise use the response header
        const contentType = providedContentType || audioResponse.headers.get('content-type') || 'audio/wav';
        console.log(`Using content type: ${contentType}`);
        
        const audioBlob = await audioResponse.blob();
        
        console.log(`Audio blob created. Size: ${audioBlob.size} bytes, Type: ${audioBlob.type || contentType}`);
        
        if (audioBlob.size === 0) {
          console.error('Downloaded audio blob has zero size');
          throw new Error('Downloaded audio file is empty');
        }
        
        const arrayBuffer = await audioBlob.arrayBuffer();
        console.log(`ArrayBuffer created. Size: ${arrayBuffer.byteLength} bytes`);
        
        // Convert to base64 - handle large files properly
        const uint8Array = new Uint8Array(arrayBuffer);
        let base64Audio = '';
        
        // Process in chunks to avoid call stack size exceeded for large files
        const chunkSize = 32768; // 32KB chunks
        console.log(`Starting base64 encoding of audio file (${uint8Array.length} bytes)...`);
        try {
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            base64Audio += String.fromCharCode.apply(null, Array.from(chunk));
            // Log progress for large files
            if (i % (chunkSize * 10) === 0 && i > 0) {
              console.log(`Base64 encoding progress: ${Math.round(i/uint8Array.length*100)}%`);
            }
          }
          base64Audio = btoa(base64Audio);
          console.log(`Base64 encoding complete. Length: ${base64Audio.length} characters`);
        } catch (encodeError) {
          console.error('Error during base64 encoding:', encodeError);
          throw new Error('Failed to encode audio data: ' + encodeError.message);
        }
        
        // Get the mime type from the blob or response headers
        const mimeType = audioBlob.type || contentType || 'audio/wav';
        console.log(`Using MIME type: ${mimeType} for audio processing`);
        
        // Use Gemini to transcribe the audio and generate initial summary
        console.log('Sending audio to Gemini API for processing...');
        try {
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
          console.log('Gemini transcription response received. Length:', responseText.length);
          if (responseText.length > 0) {
            console.log('Response preview:', responseText.substring(0, 200) + '...');
          } else {
            console.error('EMPTY RESPONSE from Gemini API');
            throw new Error('Received empty response from Gemini API');
          }
        
          try {
            // Try to parse the response as JSON
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
            let jsonContent = jsonMatch ? (jsonMatch[1] || jsonMatch[2]) : responseText;
            
            // If no valid JSON found, try a more aggressive approach
            if (!jsonContent || jsonContent.trim().length < 10) {
              console.log('No valid JSON found with regex, trying direct extraction');
              // Try to extract any JSON object
              const possibleJsonMatch = responseText.match(/(\{[\s\S]*?\})/g);
              if (possibleJsonMatch && possibleJsonMatch.length > 0) {
                jsonContent = possibleJsonMatch[0];
              }
            }

            // Log the extracted JSON content for debugging
            console.log('Extracted JSON content:', jsonContent.substring(0, 200) + '...');
          
            try {
              const parsedResponse = JSON.parse(jsonContent);
              console.log('JSON parsed successfully, checking fields...');
              console.log('transcription field present:', !!parsedResponse.transcription);
              console.log('notes field present:', !!parsedResponse.notes);
              console.log('summary field present:', !!parsedResponse.summary);
              console.log('keyPoints field present:', !!parsedResponse.keyPoints);
            
              if (parsedResponse.transcription && typeof parsedResponse.transcription === 'string' && parsedResponse.transcription.trim().length > 0) {
                transcription = parsedResponse.transcription;
                summaryContent = parsedResponse.notes || parsedResponse.summary || '';
                audioText = transcription;
              
                // Log success for debugging
                console.log('Successfully parsed JSON response with valid transcription');
                console.log('Transcription length:', transcription.length);
                console.log('Transcription preview:', transcription.substring(0, 100) + '...');
              } else {
                // If transcription is missing or empty, use more robust extraction
                console.log('Transcription missing or empty in parsed JSON, trying regex extraction');
                transcription = extractTranscriptionBetter(responseText);
                summaryContent = extractSummaryBetter(responseText);
                audioText = transcription;

                // Log the extracted content
                console.log('Regex extraction result - transcription length:', transcription.length);
                console.log('Regex extraction result - summary length:', summaryContent.length);

                // If extraction still yields no results, try finding any substantial text
                if (!transcription.trim()) {
                  console.error('Failed to extract transcription with regex, looking for any text blocks');
                  
                  // Try to find any substantial text blocks
                  const textBlocks = responseText.split(/\n\n+/).filter(block => 
                    block.trim().length > 50 && 
                    !block.includes('```')
                  );
                  
                  if (textBlocks.length > 0) {
                    console.log('Found text block of length:', textBlocks[0].length);
                    transcription = textBlocks[0].trim();
                    audioText = transcription;
                  } else {
                    throw new Error('Failed to extract any meaningful text from response');
                  }
                }
              }
            } catch (jsonParseError) {
              console.error('Error parsing JSON string:', jsonParseError);
              // Try regex extraction
              transcription = extractTranscriptionBetter(responseText);
              summaryContent = extractSummaryBetter(responseText);
              audioText = transcription;

              console.log('After parse error, regex extraction - transcription length:', transcription.length);
              console.log('After parse error, regex extraction - summary length:', summaryContent.length);

              // If extraction yields no results, look for any text content
              if (!transcription.trim()) {
                // Last resort - look for any text in the response
                const lines = responseText.split('\n').filter(line => 
                  line.trim().length > 30 && 
                  !line.includes('```') &&
                  !line.startsWith('#') &&
                  !line.startsWith('>')
                );
                
                if (lines.length > 0) {
                  transcription = lines.join('\n\n');
                  audioText = transcription;
                  console.log('Extracted text lines as fallback. Length:', transcription.length);
                } else {
                  throw new Error('Failed to extract any meaningful content from response');
                }
              }
            }
          } catch (parseError) {
            console.error('Error with response parsing:', parseError);
            throw new Error('Failed to process response from transcription API');
          }
        } catch (geminiError) {
          console.error('Error calling Gemini API:', geminiError);
          throw new Error('Failed to process audio with Gemini API: ' + geminiError.message);
        }
      } catch (downloadError) {
        console.error('Error processing audio:', downloadError);
        throw new Error('Failed to process audio file: ' + downloadError.message);
      }
    } else if (audioText) {
      // CASE 2: Process text if no audio file is provided but text is
      console.log('Processing text input of length:', audioText.length);
      // ... existing code for text processing ...
    } else {
      console.error('No audio URL or text provided');
      throw new Error('No audio URL or text provided');
    }
    
    // Verify we have actual content before continuing
    console.log('Final transcription check - length:', transcription?.length || 0);
    console.log('Final transcription check - trimmed length:', transcription?.trim()?.length || 0);
    
    if (!transcription || !transcription.trim() || transcription.trim().length < 10) {
      console.error('Insufficient transcription content. Transcription:', transcription);
      throw new Error('Unable to extract meaningful transcription from the audio. Please check the file format and try again.');
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

    // Final verification that we're not returning empty content
    if (!transcription.trim()) {
      console.error('Empty transcription after processing');
      return new Response(JSON.stringify(EMPTY_RESPONSE), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    return new Response(JSON.stringify({ 
      error: error.message,
      ...EMPTY_RESPONSE  // Include empty response to prevent any default content
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions with improved extraction logic
function extractTranscriptionBetter(text: string): string {
  // Look for various patterns that might indicate the transcription section
  const patterns = [
    /transcription[:\s]*["']?([\s\S]*?)["']?(?=(?:notes|summary|key\s*points)[:\s]*["']?|$)/i,
    /["']transcription["'][:\s]*["']?([\s\S]*?)["']?(?=["'](?:notes|summary|key\s*points)["'][:\s]*["']?|$)/i,
    /transcript[:\s]*["']?([\s\S]*?)["']?(?=(?:notes|summary|key\s*points)[:\s]*["']?|$)/i,
    /"transcript"[:\s]*"([\s\S]*?)"(?=,|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      return match[1].trim();
    }
  }

  // If all patterns fail, try to extract any substantial text block
  const textBlocks = text.split(/\n\n+/).filter(block => 
    block.trim().length > 100 && 
    !block.trim().startsWith('#') && 
    !block.includes('```')
  );
  
  if (textBlocks.length > 0) {
    return textBlocks[0].trim();
  }

  // Last resort - return empty string, never default sample content
  return '';
}

function extractSummaryBetter(text: string): string {
  // Try to find a section marked as summary or notes
  const patterns = [
    /(?:summary|notes)[:\s]*["']?([\s\S]*?)["']?(?=(?:transcription|key\s*points)[:\s]*["']?|$)/i,
    /["'](?:summary|notes)["'][:\s]*["']?([\s\S]*?)["']?(?=["'](?:transcription|key\s*points)["'][:\s]*["']?|$)/i,
    /## summary\s+([\s\S]*?)(?=##|$)/i,
    /## notes\s+([\s\S]*?)(?=##|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      return match[1].trim();
    }
  }

  // Look for markdown-formatted sections
  const sections = text.match(/##[^#](.*?)(?=##[^#]|$)/gs);
  if (sections && sections.length > 0) {
    return sections.join('\n\n');
  }

  // Return empty string if no summary found
  return '';
}

// Legacy functions - kept for reference but no longer used directly
function extractTranscription(text: string): string {
  const match = text.match(/TRANSCRIPTION:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
  return match ? match[1].trim() : '';
}

function extractSummary(text: string): string {
  const match = text.match(/SUMMARY:\s*([\s\S]*)/i);
  return match ? match[1].trim() : '';
}
