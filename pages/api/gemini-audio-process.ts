import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Disable the default body parser to handle form data with files
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    
    // Parse the form data
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    // Get the audio file
    const audioFile = files.audio;
    if (!audioFile || Array.isArray(audioFile)) {
      return res.status(400).json({ error: 'No audio file or multiple files provided' });
    }

    // Read the file
    const audioBuffer = await fs.promises.readFile(audioFile.filepath);
    
    // Convert buffer to base64
    const audioBase64 = audioBuffer.toString('base64');
    
    // Get the Gemini model - use gemini-pro-vision for multimodal capabilities
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    
    // Create parts for multimodal prompt
    const fileType = audioFile.mimetype || 'audio/wav';
    const parts: Part[] = [
      {
        inlineData: {
          data: audioBase64,
          mimeType: fileType
        }
      },
      {
        text: `Please transcribe the audio file accurately. Then, provide a concise summary of the transcription that captures the essential information and can be used as lecture notes. Format your response as follows:

TRANSCRIPTION:
[transcription text here]

SUMMARY:
[summary text here]`
      }
    ];

    // Generate the content
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const response = result.response.text();

    // Parse the response to extract transcription and summary
    const transcription = extractTranscription(response);
    const summary = extractSummary(response);

    // Clean up temporary file
    fs.unlink(audioFile.filepath, (err) => {
      if (err) console.error('Error removing temporary file:', err);
    });

    return res.status(200).json({ 
      transcription, 
      summary 
    });
  } catch (error: any) {
    console.error('Audio processing error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process audio' });
  }
}

// Helper functions to extract transcription and summary from the response
function extractTranscription(text: string): string {
  const match = text.match(/TRANSCRIPTION:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
  return match ? match[1].trim() : '';
}

function extractSummary(text: string): string {
  const match = text.match(/SUMMARY:\s*([\s\S]*)/i);
  return match ? match[1].trim() : '';
}
