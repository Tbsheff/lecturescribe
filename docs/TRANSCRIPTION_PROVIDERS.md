# Transcription Provider Toggle System

This document explains how to configure and use the dual transcription provider system that supports both Deepgram and Gemini AI for audio transcription.

## Overview

The application now supports two transcription providers:

1. **Gemini AI** (Default) - Google's multimodal AI with advanced summarization capabilities
2. **Deepgram** - Professional speech-to-text API service

Users can toggle between providers or set up automatic fallback for improved reliability.

## Configuration

### Environment Variables

Set these environment variables to configure transcription providers:

#### For Supabase Edge Functions:
```bash
GEMINI_API_KEY=your_gemini_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
TRANSCRIPTION_PROVIDER=gemini  # or 'deepgram'
TRANSCRIPTION_FALLBACK_PROVIDER=deepgram  # optional fallback
```

#### For Frontend (in .env):
```bash
VITE_TRANSCRIPTION_PROVIDER=gemini
VITE_TRANSCRIPTION_FALLBACK_PROVIDER=deepgram
```

### Provider Configuration

Each provider has specific configuration options:

**Gemini Configuration:**
- `GEMINI_API_KEY`: Required API key from Google AI Studio
- `GEMINI_MODEL`: Model name (default: `gemini-2.0-flash`)

**Deepgram Configuration:**
- `DEEPGRAM_API_KEY`: Required API key from Deepgram Console
- `DEEPGRAM_MODEL`: Model name (default: `nova-2`)
- `DEEPGRAM_LANGUAGE`: Language code (default: `en`)

## Usage

### Programmatic Usage

```typescript
import { processAudioWithSummary } from '@/services/transcription';

// Use default provider
const result = await processAudioWithSummary(audioFile, userId, metadata);

// Use specific provider
const result = await processAudioWithSummary(audioFile, userId, metadata, 'deepgram');
```

### Configuration Service

```typescript
import { transcriptionConfig } from '@/services/transcriptionConfig';

// Get current settings
const settings = transcriptionConfig.getSettings();

// Change default provider
transcriptionConfig.setDefaultProvider('deepgram');

// Set fallback provider
transcriptionConfig.setFallbackProvider('gemini');

// Allow/disallow manual provider selection
transcriptionConfig.toggleProviderSelection(true);
```

### UI Components

The `TranscriptionSettings` component provides a user interface for:
- Selecting default provider
- Configuring fallback provider
- Enabling/disabling manual provider selection
- Viewing provider features and capabilities

```tsx
import { TranscriptionSettings } from '@/components/settings/TranscriptionSettings';

<TranscriptionSettings />
```

## Provider Comparison

| Feature | Gemini AI | Deepgram |
|---------|-----------|----------|
| **Accuracy** | High | Very High |
| **Speed** | Fast | Very Fast |
| **Summarization** | Advanced | Basic |
| **Note Structuring** | Yes | No |
| **Languages** | 100+ | 30+ |
| **Cost** | Free tier | Pay per use |
| **Best For** | Lectures, meetings | Interviews, calls |

## Architecture

### Provider Pattern
The system uses the Provider Pattern with:
- `TranscriptionProvider` abstract base class
- `GeminiProvider` and `DeepgramProvider` implementations
- `TranscriptionManager` for provider selection and fallback

### Fallback Mechanism
When a primary provider fails:
1. The system automatically tries the configured fallback provider
2. If no fallback is configured, it uses any available provider
3. If no providers are available, it returns an error

### Frontend Integration
- Configuration is stored in localStorage
- Settings persist across browser sessions
- Real-time provider switching without page refresh

## Error Handling

The system includes comprehensive error handling:
- Provider availability checks
- API key validation
- Network error recovery
- Graceful fallbacks

Common error scenarios:
- Invalid API keys → Falls back to alternative provider
- Network timeouts → Retries with fallback
- Unsupported file formats → Clear error messages

## Security

API keys are handled securely:
- Stored as environment variables
- Never exposed to client-side code
- Processed only in Supabase Edge Functions

## Troubleshooting

### Common Issues

1. **"No transcription providers are available"**
   - Check that at least one API key is configured
   - Verify environment variable names are correct

2. **"Provider not available"**
   - Ensure the requested provider has a valid API key
   - Check API key permissions and quotas

3. **"Transcription failed"**
   - Check audio file format (supported: WAV, MP3, M4A, WebM)
   - Verify file size is under 100MB
   - Check network connectivity

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will log provider selection, fallback attempts, and detailed error information.

## Migration from Single Provider

If upgrading from a single-provider setup:
1. Existing Gemini configuration will continue to work
2. Add Deepgram API key to enable dual-provider mode
3. No code changes required - fallback is automatic

## Future Enhancements

Planned features:
- Azure Speech Services provider
- OpenAI Whisper integration
- Custom provider plugins
- Usage analytics and cost tracking
- A/B testing between providers