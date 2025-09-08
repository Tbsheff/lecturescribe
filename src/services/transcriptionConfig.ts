import { TranscriptionProviderType } from '@/types/transcription';

export interface TranscriptionSettings {
  defaultProvider: TranscriptionProviderType;
  fallbackProvider?: TranscriptionProviderType;
  allowProviderSelection: boolean;
}

// Default configuration
const DEFAULT_CONFIG: TranscriptionSettings = {
  defaultProvider: 'gemini', // Keep Gemini as default for backward compatibility
  fallbackProvider: 'deepgram',
  allowProviderSelection: true
};

// Configuration storage key
const CONFIG_STORAGE_KEY = 'transcription-settings';

export class TranscriptionConfigService {
  private static instance: TranscriptionConfigService;
  private settings: TranscriptionSettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): TranscriptionConfigService {
    if (!TranscriptionConfigService.instance) {
      TranscriptionConfigService.instance = new TranscriptionConfigService();
    }
    return TranscriptionConfigService.instance;
  }

  private loadSettings(): TranscriptionSettings {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        return { ...DEFAULT_CONFIG, ...parsedSettings };
      }
    } catch (error) {
      console.warn('Failed to load transcription settings from localStorage:', error);
    }
    return DEFAULT_CONFIG;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save transcription settings to localStorage:', error);
    }
  }

  public getSettings(): TranscriptionSettings {
    return { ...this.settings };
  }

  public getDefaultProvider(): TranscriptionProviderType {
    return this.settings.defaultProvider;
  }

  public getFallbackProvider(): TranscriptionProviderType | undefined {
    return this.settings.fallbackProvider;
  }

  public isProviderSelectionAllowed(): boolean {
    return this.settings.allowProviderSelection;
  }

  public updateSettings(newSettings: Partial<TranscriptionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public setDefaultProvider(provider: TranscriptionProviderType): void {
    this.settings.defaultProvider = provider;
    this.saveSettings();
  }

  public setFallbackProvider(provider: TranscriptionProviderType | undefined): void {
    this.settings.fallbackProvider = provider;
    this.saveSettings();
  }

  public toggleProviderSelection(enabled: boolean): void {
    this.settings.allowProviderSelection = enabled;
    this.saveSettings();
  }

  public resetToDefaults(): void {
    this.settings = { ...DEFAULT_CONFIG };
    this.saveSettings();
  }
}

// Export singleton instance
export const transcriptionConfig = TranscriptionConfigService.getInstance();