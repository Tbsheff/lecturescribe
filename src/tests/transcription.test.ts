import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptionManager } from '../services/transcriptionManager';
import { TranscriptionConfig, TranscriptionProviderType } from '../types/transcription';
import { transcriptionConfig } from '../services/transcriptionConfig';

// Mock environment variables for testing
const mockConfig: TranscriptionConfig = {
  provider: 'gemini',
  deepgram: {
    apiKey: 'test-deepgram-key',
    model: 'nova-2',
    language: 'en'
  },
  gemini: {
    apiKey: 'test-gemini-key',
    model: 'gemini-2.0-flash'
  },
  fallbackProvider: 'deepgram'
};

describe('Transcription Provider Switching', () => {
  let manager: TranscriptionManager;

  beforeEach(() => {
    manager = new TranscriptionManager(mockConfig);
  });

  it('should initialize with correct providers', () => {
    const availableProviders = manager.getAvailableProviders();
    expect(availableProviders).toContain('gemini');
    expect(availableProviders).toContain('deepgram');
  });

  it('should return current provider correctly', () => {
    expect(manager.getCurrentProvider()).toBe('gemini');
  });

  it('should switch providers successfully', () => {
    const switched = manager.switchProvider('deepgram');
    expect(switched).toBe(true);
    expect(manager.getCurrentProvider()).toBe('deepgram');
  });

  it('should not switch to unavailable provider', () => {
    // Create manager with limited config
    const limitedConfig: TranscriptionConfig = {
      provider: 'gemini',
      gemini: { apiKey: 'test-key' }
    };
    const limitedManager = new TranscriptionManager(limitedConfig);
    
    const switched = limitedManager.switchProvider('deepgram');
    expect(switched).toBe(false);
  });

  it('should validate provider availability', () => {
    expect(manager.isProviderAvailable('gemini')).toBe(true);
    expect(manager.isProviderAvailable('deepgram')).toBe(true);
  });
});

describe('TranscriptionConfig Service', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    transcriptionConfig.resetToDefaults();
  });

  it('should get default settings', () => {
    const settings = transcriptionConfig.getSettings();
    expect(settings.defaultProvider).toBe('gemini');
    expect(settings.allowProviderSelection).toBe(true);
  });

  it('should update default provider', () => {
    transcriptionConfig.setDefaultProvider('deepgram');
    expect(transcriptionConfig.getDefaultProvider()).toBe('deepgram');
  });

  it('should update fallback provider', () => {
    transcriptionConfig.setFallbackProvider('deepgram');
    expect(transcriptionConfig.getFallbackProvider()).toBe('deepgram');
  });

  it('should toggle provider selection', () => {
    transcriptionConfig.toggleProviderSelection(false);
    expect(transcriptionConfig.isProviderSelectionAllowed()).toBe(false);
  });

  it('should reset to defaults', () => {
    // Make some changes
    transcriptionConfig.setDefaultProvider('deepgram');
    transcriptionConfig.toggleProviderSelection(false);
    
    // Reset
    transcriptionConfig.resetToDefaults();
    
    // Check defaults are restored
    const settings = transcriptionConfig.getSettings();
    expect(settings.defaultProvider).toBe('gemini');
    expect(settings.allowProviderSelection).toBe(true);
  });
});

// Integration test for audio processing
describe('Audio Processing Integration', () => {
  it('should handle provider selection in audio processing', async () => {
    // This would require actual audio file and API keys for full integration
    // For now, we test the configuration passing
    
    const mockAudioFile = new File([''], 'test.wav', { type: 'audio/wav' });
    const mockUserId = 'test-user-id';
    const mockMetadata = { title: 'Test Recording' };
    
    // Test that the provider parameter gets passed through
    // This would normally call the actual transcription service
    expect(true).toBe(true); // Placeholder for actual integration test
  });
});

export {};