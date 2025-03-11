import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import OpenAI from 'openai';

// Configure API client for OpenAI (using Whisper for transcription)
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

    // Read the file and create a readable stream
    const fileStream = fs.createReadStream(audioFile.filepath);
    
    // Create a passthrough stream to pipe the file data
    const passThrough = new PassThrough();
    fileStream.pipe(passThrough);
    
    // Transcribe the audio using OpenAI's Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: {
        content: await fileToBuffer(audioFile.filepath),
        name: audioFile.originalFilename || 'audio.wav',
      },
      model: 'whisper-1',
    });

    // Clean up temporary file
    fs.unlink(audioFile.filepath, (err) => {
      if (err) console.error('Error removing temporary file:', err);
    });

    return res.status(200).json({ transcription: transcription.text });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to transcribe audio' });
  }
}

// Helper function to convert file to buffer
async function fileToBuffer(filePath: string): Promise<Buffer> {
  return fs.promises.readFile(filePath);
}
