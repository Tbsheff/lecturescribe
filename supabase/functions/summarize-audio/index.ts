import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createTranscriptionManager } from "../shared/transcriptionManager.ts";
import { AudioFile, TranscriptionProviderType } from "../shared/transcriptionTypes.ts";

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
    // Initialize transcription manager with environment config
    const transcriptionManager = createTranscriptionManager();
    const availableProviders = transcriptionManager.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No transcription providers are configured. Please set GEMINI_API_KEY or DEEPGRAM_API_KEY.');
    }
    
    console.log('Available transcription providers:', availableProviders);

    const { audioText, audioUrl, contentType: providedContentType, fileName, provider } = await req.json();
    
    let transcription = "";
    let summaryContent = "";

    // CASE 1: Process audio file if URL is provided
    if (audioUrl) {
      console.log(`Processing audio file from URL: ${audioUrl}`);
      if (fileName) console.log(`File name: ${fileName}`);
      if (providedContentType) console.log(`Content type provided by client: ${providedContentType}`);
      if (provider) console.log(`Requested provider: ${provider}`);
      
      try {
        // Prepare audio file for transcription
        const audioFile: AudioFile = {
          url: audioUrl,
          mimeType: providedContentType || 'audio/wav',
          filename: fileName
        };

        // Use transcription manager to process audio
        const options = {
          provider: provider as TranscriptionProviderType, // Allow specific provider override
          summarize: true,
          includeKeyPoints: true
        };

        console.log('Starting transcription with manager...');
        const result = await transcriptionManager.transcribeAudio(audioFile, options);
        
        transcription = result.transcription;
        summaryContent = result.notes || result.summary || '';
        audioText = transcription;
        
        console.log('Transcription completed successfully');
        console.log('Transcription length:', transcription.length);
        console.log('Transcription preview:', transcription.substring(0, 100) + '...');
        
      } catch (transcriptionError) {
        console.error('Error during transcription:', transcriptionError);
        throw new Error('Failed to transcribe audio: ' + transcriptionError.message);
      }
    } else if (audioText) {
      // CASE 2: Process text if no audio file is provided but text is
      console.log('Processing text input of length:', audioText.length);
      transcription = audioText;
      summaryContent = audioText.substring(0, 500) + '...'; // Simple fallback for text
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

// Helper functions - kept for backward compatibility but not used with new provider system