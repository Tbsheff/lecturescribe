import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Fixed summary content for testing and development
const FIXED_SUMMARY = `
Modern Computing Architecture Lecture Summary:

Key Topics:
- CPU architecture and memory management evolution
- Software-hardware interface mechanisms
- Computing optimization techniques
- Emerging trends in computing architecture

Main Points:
1. CPU design has evolved from single-core to multi-core processors
2. Memory management now uses complex virtual memory systems
3. Operating systems provide abstraction layers between applications and hardware
4. System calls, device drivers, and kernel interfaces facilitate software-hardware communication
5. Optimization relies on branch prediction, speculative execution, and cache techniques
6. Future trends include quantum computing, neuromorphic systems, and specialized AI processors
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcription } = req.body;
    
    if (!transcription) {
      return res.status(400).json({ error: 'Transcription is required' });
    }

    // Get the Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Create a prompt for summarization
    const prompt = `Please provide a concise summary of the following transcription, highlighting the key points and main ideas:
    
${transcription}
    
Create a summary that captures the essential information and can be used as lecture notes.`;

    // Generate the summary
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    return res.status(200).json({ summary });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
}
