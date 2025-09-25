import { TranscriptionProvider, TranscriptionResult, TranscriptionOptions, AudioFile } from './transcriptionTypes.ts';

export class DeepgramProvider extends TranscriptionProvider {
  name = 'deepgram';
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
      throw new Error('Deepgram API key not available');
    }

    try {
      const transcriptionOptions = {
        model: options?.model || 'nova-2',
        language: options?.language || 'en',
        smart_format: true,
        punctuate: true,
        diarize: false,
        summarize: options?.summarize !== false ? 'v2' : false,
        detect_topics: true,
        paragraphs: true,
        utterances: true,
      };

      const url = 'https://api.deepgram.com/v1/listen';
      const queryParams = new URLSearchParams();
      
      // Add transcription options to query params
      Object.entries(transcriptionOptions).forEach(([key, value]) => {
        if (value !== undefined && value !== false) {
          queryParams.append(key, value.toString());
        }
      });

      let response;

      if (audio.url) {
        // Transcribe from URL
        response = await fetch(`${url}?${queryParams}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: audio.url }),
        });
      } else if (audio.buffer) {
        // Transcribe from buffer
        response = await fetch(`${url}?${queryParams}`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': audio.mimeType || 'audio/wav',
          },
          body: audio.buffer,
        });
      } else {
        throw new Error('No audio URL or buffer provided');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deepgram API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const transcript = result?.results?.channels?.[0]?.alternatives?.[0];
      
      if (!transcript || !transcript.transcript) {
        throw new Error('No transcription received from Deepgram');
      }

      // Extract transcription
      const transcription = transcript.transcript;
      
      // Generate summary if available
      let summary = '';
      if (result?.results?.summary) {
        summary = result.results.summary.result || '';
      }

      // Extract key points from topics
      const keyPoints: string[] = [];
      if (result?.results?.topics) {
        result.results.topics.forEach((topic: { topic?: string }) => {
          if (topic.topic) {
            keyPoints.push(topic.topic);
          }
        });
      }

      // If no summary from Deepgram, create a basic one from paragraphs
      if (!summary && result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs) {
        const paragraphs = result.results.channels[0].alternatives[0].paragraphs.transcript;
        const sentences = paragraphs.split('.').slice(0, 3); // First 3 sentences as summary
        summary = sentences.join('.').trim() + (sentences.length === 3 ? '.' : '');
      }

      return {
        transcription,
        summary: summary || transcription.substring(0, 200) + '...', // Fallback summary
        keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
        confidence: transcript.confidence,
        language: options?.language || 'en'
      };

    } catch (error) {
      console.error('Deepgram transcription error:', error);
      throw new Error(`Deepgram transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}