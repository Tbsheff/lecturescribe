import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Initialize OpenAI client as fallback
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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
    
    // First, use OpenAI Whisper for reliable transcription
    console.log('Transcribing with OpenAI Whisper...');
    const transcription = await transcribeWithWhisper(audioFile);
    
    // Then use Gemini for summarization based on the transcription
    console.log('Getting summary from Gemini...');
    const summary = await summarizeWithGemini(transcription);
    
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

// Use OpenAI's Whisper for reliable transcription
async function transcribeWithWhisper(audioFile: formidable.File): Promise<string> {
  try {
    // Read the file buffer
    const buffer = await fs.promises.readFile(audioFile.filepath);

    
    // Transcribe with Whisper
    const genAI = new GoogleGenerativeAI(process.env.API_KEY);

    // Initialize a Gemini model appropriate for your use case.
    const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    });

    // Generate content using a prompt and the metadata of the uploaded file.
    const transcription = await model.generateContent([
        {
        fileData: {
            mimeType: audioFile.file.mimeType,
            fileUri: audioFile.file.uri
        }
        },
        { text: "Generate a transcript of the speech." },
    ]);
    
    console.log('Whisper transcription successful');
    return transcription.response.text();
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// Use Gemini to summarize the transcription
async function summarizeWithGemini(transcription: string): Promise<string> {
  try {
    // Get the Gemini model
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
    });
    
    // Create a prompt for summarization
    const prompt = `Please provide a concise summary of the following transcription, highlighting the key points and main ideas:
    
${transcription}
    
Create a summary that captures the essential information and can be used as lecture notes.`;

    // Generate the summary
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    console.log('Gemini summarization successful');
    return summary;
  } catch (error) {
    console.error('Gemini summarization error:', error);
    throw new Error(`Summarization failed: ${error.message}`);
  }
}

// These functions are no longer needed since we're using separate services
// function extractTranscription(text: string): string { ... }
// function extractSummary(text: string): string { ... }
