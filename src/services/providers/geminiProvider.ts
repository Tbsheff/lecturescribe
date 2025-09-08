import { TranscriptionProvider, TranscriptionResult, TranscriptionOptions, AudioFile } from '@/types/transcription';

export class GeminiProvider extends TranscriptionProvider {
  name = 'gemini';
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  async transcribeAudio(audio: AudioFile, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not available');
    }

    try {
      // Import Gemini SDK dynamically (since this might be running in different environments)
      const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.1.3');
      
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ 
        model: options?.model || "gemini-2.0-flash" 
      });

      let base64Audio: string;
      let mimeType: string = audio.mimeType;

      if (audio.buffer) {
        // Convert buffer to base64
        const uint8Array = new Uint8Array(audio.buffer);
        let binaryString = '';
        
        // Process in chunks to avoid call stack issues
        const chunkSize = 32768;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64Audio = btoa(binaryString);
      } else if (audio.url) {
        // If we have a URL, we need to fetch and convert to base64
        const response = await fetch(audio.url);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        
        const chunkSize = 32768;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64Audio = btoa(binaryString);
        
        // Use Content-Type from response if available
        const contentType = response.headers.get('content-type');
        if (contentType) {
          mimeType = contentType;
        }
      } else {
        throw new Error('No audio buffer or URL provided');
      }

      const prompt = options?.customPrompt || `You are an expert in creating lecture notes from audio transcriptions.

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

Ensure the JSON is valid and properly formatted.`;

      const result = await model.generateContent({
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
              { text: prompt }
            ]
          }
        ]
      });

      const responseText = await result.response.text();
      
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from Gemini API');
      }

      // Parse JSON response
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
      const jsonContent = jsonMatch ? (jsonMatch[1] || jsonMatch[2]) : responseText;
      
      if (!jsonContent || jsonContent.trim().length < 10) {
        throw new Error('Invalid response format from Gemini API');
      }

      const parsedResponse = JSON.parse(jsonContent);
      
      // Validate response structure
      if (!parsedResponse || typeof parsedResponse !== 'object') {
        throw new Error('Invalid response structure from Gemini API');
      }

      if (!parsedResponse.transcription || 
          typeof parsedResponse.transcription !== 'string' || 
          parsedResponse.transcription.trim().length < 10) {
        throw new Error('Invalid or empty transcription in response');
      }

      // Check for sample content indicators
      const sampleContentIndicators = [
        'sample lecture',
        'modern computing architecture',
        'this is a test',
        'this is an example'
      ];

      if (sampleContentIndicators.some(indicator => 
        parsedResponse.transcription.toLowerCase().includes(indicator))) {
        throw new Error('Received sample content instead of actual transcription');
      }

      return {
        transcription: parsedResponse.transcription,
        summary: parsedResponse.summary || parsedResponse.notes || '',
        notes: parsedResponse.notes,
        keyPoints: parsedResponse.keyPoints,
        language: options?.language || 'auto'
      };

    } catch (error) {
      console.error('Gemini transcription error:', error);
      throw new Error(`Gemini transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}