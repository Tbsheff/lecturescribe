import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

    console.log('Processing audio file:', audioFile.originalFilename, audioFile.mimetype, audioFile.size);
    
    // Read the file and convert to base64
    const fileBuffer = await fs.promises.readFile(audioFile.filepath);
    const base64Audio = fileBuffer.toString('base64');
    
    // Get the Gemini model (using gemini-1.5-pro which has multimodal capabilities)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    console.log('Requesting transcription and summary from Gemini...');
    
    // Create multimodal prompt for Gemini
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { 
              inline_data: { 
                mime_type: audioFile.mimetype || 'audio/wav',
                data: base64Audio 
              }
            },
            { 
              text: `Please transcribe the audio file and then provide a concise summary highlighting the key points.

Format your response exactly like this:

TRANSCRIPTION:
[The full transcription text here]

SUMMARY:
[A concise summary of the key points here]`
            }
          ]
        }
      ]
    });

    const responseText = result.response.text();
    console.log('Gemini response received');
    
    // Parse the response to extract transcription and summary
    const transcription = extractTranscription(responseText);
    const summary = extractSummary(responseText);
    
    // Clean up temporary file
    fs.unlink(audioFile.filepath, (err) => {
      if (err) console.error('Error removing temporary file:', err);
    });

    // Return both transcription and summary
    console.log('Successfully processed audio. Returning results...');
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
