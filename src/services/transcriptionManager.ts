import { TranscriptionProvider, TranscriptionResult, TranscriptionOptions, AudioFile, TranscriptionConfig, TranscriptionProviderType } from '@/types/transcription';
import { DeepgramProvider } from './providers/deepgramProvider';
import { GeminiProvider } from './providers/geminiProvider';

export class TranscriptionManager {
  private config: TranscriptionConfig;
  private providers: Map<TranscriptionProviderType, TranscriptionProvider>;

  constructor(config: TranscriptionConfig) {
    this.config = config;
    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Deepgram provider if configured
    if (this.config.deepgram?.apiKey) {
      try {
        const deepgramProvider = new DeepgramProvider(this.config.deepgram.apiKey);
        this.providers.set('deepgram', deepgramProvider);
      } catch (error) {
        console.warn('Failed to initialize Deepgram provider:', error);
      }
    }

    // Initialize Gemini provider if configured
    if (this.config.gemini?.apiKey) {
      try {
        const geminiProvider = new GeminiProvider(this.config.gemini.apiKey);
        this.providers.set('gemini', geminiProvider);
      } catch (error) {
        console.warn('Failed to initialize Gemini provider:', error);
      }
    }
  }

  public getAvailableProviders(): TranscriptionProviderType[] {
    return Array.from(this.providers.keys()).filter(type => {
      const provider = this.providers.get(type);
      return provider?.isAvailable() ?? false;
    });
  }

  public isProviderAvailable(providerType: TranscriptionProviderType): boolean {
    const provider = this.providers.get(providerType);
    return provider?.isAvailable() ?? false;
  }

  public async transcribeAudio(
    audio: AudioFile, 
    options?: TranscriptionOptions & { provider?: TranscriptionProviderType }
  ): Promise<TranscriptionResult> {
    const requestedProvider = options?.provider || this.config.provider;
    
    // Try the requested provider first
    if (this.isProviderAvailable(requestedProvider)) {
      try {
        const provider = this.providers.get(requestedProvider)!;
        console.log(`Using ${provider.name} provider for transcription`);
        return await provider.transcribeAudio(audio, options);
      } catch (error) {
        console.error(`${requestedProvider} transcription failed:`, error);
        
        // If we have a fallback provider configured, try it
        if (this.config.fallbackProvider && 
            this.config.fallbackProvider !== requestedProvider &&
            this.isProviderAvailable(this.config.fallbackProvider)) {
          console.log(`Falling back to ${this.config.fallbackProvider} provider`);
          try {
            const fallbackProvider = this.providers.get(this.config.fallbackProvider)!;
            return await fallbackProvider.transcribeAudio(audio, options);
          } catch (fallbackError) {
            console.error(`Fallback provider ${this.config.fallbackProvider} also failed:`, fallbackError);
            throw new Error(`Both primary (${requestedProvider}) and fallback (${this.config.fallbackProvider}) transcription services failed`);
          }
        }
        
        throw error;
      }
    }

    // If requested provider is not available, try any available provider
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error('No transcription providers are available. Please check your API key configuration.');
    }

    // Try the first available provider
    const provider = this.providers.get(availableProviders[0])!;
    console.log(`Requested provider ${requestedProvider} not available, using ${provider.name} instead`);
    return await provider.transcribeAudio(audio, options);
  }

  public switchProvider(providerType: TranscriptionProviderType): boolean {
    if (this.isProviderAvailable(providerType)) {
      this.config.provider = providerType;
      return true;
    }
    return false;
  }

  public getCurrentProvider(): TranscriptionProviderType {
    return this.config.provider;
  }

  public getProviderConfig(): TranscriptionConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.providers.clear();
    this.initializeProviders();
  }
}

// Factory function to create transcription manager with environment-based config
export function createTranscriptionManager(): TranscriptionManager {
  const config: TranscriptionConfig = {
    provider: (process.env.TRANSCRIPTION_PROVIDER as TranscriptionProviderType) || 'gemini',
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY || '',
      model: process.env.DEEPGRAM_MODEL || 'nova-2',
      language: process.env.DEEPGRAM_LANGUAGE || 'en'
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    },
    fallbackProvider: (process.env.TRANSCRIPTION_FALLBACK_PROVIDER as TranscriptionProviderType) || undefined
  };

  return new TranscriptionManager(config);
}

// Export singleton instance for convenience
let transcriptionManager: TranscriptionManager | null = null;

export function getTranscriptionManager(): TranscriptionManager {
  if (!transcriptionManager) {
    transcriptionManager = createTranscriptionManager();
  }
  return transcriptionManager;
}