import { createClient } from '@deepgram/sdk';
import { TranscriptionProvider, TranscriptionResult, TranscriptionOptions, AudioFile } from '@/types/transcription';

export class DeepgramProvider extends TranscriptionProvider {
  name = 'deepgram';
  private apiKey: string;
  private client: any;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.client = createClient(apiKey);
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
        summarize: options?.summarize !== false,
        detect_topics: true,
        paragraphs: true,
        utterances: true,
      };

      let response;

      if (audio.url) {
        // Transcribe from URL
        response = await this.client.listen.prerecorded.transcribeUrl(
          { url: audio.url },
          transcriptionOptions
        );
      } else {
        // Transcribe from buffer
        response = await this.client.listen.prerecorded.transcribeFile(
          audio.buffer,
          transcriptionOptions
        );
      }

      const transcript = response.result?.results?.channels[0]?.alternatives[0];
      
      if (!transcript || !transcript.transcript) {
        throw new Error('No transcription received from Deepgram');
      }

      // Extract transcription
      const transcription = transcript.transcript;
      
      // Generate summary if requested and available
      let summary = '';
      if (response.result?.results?.summary) {
        summary = response.result.results.summary.result || '';
      }

      // Extract key points from topics or paragraphs
      const keyPoints: string[] = [];
      if (response.result?.results?.topics) {
        response.result.results.topics.forEach((topic: any) => {
          if (topic.topic) {
            keyPoints.push(topic.topic);
          }
        });
      }

      // If no summary from Deepgram, create a basic one from paragraphs
      if (!summary && response.result?.results?.channels[0]?.alternatives[0]?.paragraphs) {
        const paragraphs = response.result.results.channels[0].alternatives[0].paragraphs.transcript;
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