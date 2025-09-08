// Audio processing utilities for real-time transcription

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  duration: number;
  sequenceNumber: number;
}

export interface AudioQualityMetrics {
  volume: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  silenceRatio: number;
  noiseLevel: number;
}

export class AudioBufferManager {
  private chunks: AudioChunk[] = [];
  private sequenceNumber = 0;
  private maxBufferSize = 50; // Maximum number of chunks to keep
  private minChunkDuration = 20; // Minimum chunk duration in ms
  private maxChunkDuration = 250; // Maximum chunk duration in ms

  constructor(options?: {
    maxBufferSize?: number;
    minChunkDuration?: number;
    maxChunkDuration?: number;
  }) {
    if (options) {
      this.maxBufferSize = options.maxBufferSize ?? this.maxBufferSize;
      this.minChunkDuration = options.minChunkDuration ?? this.minChunkDuration;
      this.maxChunkDuration = options.maxChunkDuration ?? this.maxChunkDuration;
    }
  }

  addChunk(data: ArrayBuffer, duration: number = 100): AudioChunk {
    const chunk: AudioChunk = {
      data,
      timestamp: Date.now(),
      duration,
      sequenceNumber: this.sequenceNumber++
    };

    this.chunks.push(chunk);

    // Clean up old chunks if buffer is full
    if (this.chunks.length > this.maxBufferSize) {
      this.chunks.shift();
    }

    return chunk;
  }

  getRecentChunks(count: number = 10): AudioChunk[] {
    return this.chunks.slice(-count);
  }

  getChunksSince(timestamp: number): AudioChunk[] {
    return this.chunks.filter(chunk => chunk.timestamp >= timestamp);
  }

  getTotalDuration(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.duration, 0);
  }

  clear(): void {
    this.chunks = [];
    this.sequenceNumber = 0;
  }

  getOptimalChunkSize(sampleRate: number = 16000): number {
    // Calculate optimal chunk size based on Deepgram's recommendations (20-250ms)
    const bytesPerSample = 2; // 16-bit audio
    const channels = 1; // Mono
    const targetDurationMs = 100; // 100ms sweet spot
    
    const samplesPerChunk = (sampleRate * targetDurationMs) / 1000;
    return samplesPerChunk * bytesPerSample * channels;
  }
}

export class AudioQualityAnalyzer {
  private analyserNode: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private audioContext: AudioContext | null = null;

  constructor(audioContext?: AudioContext) {
    this.audioContext = audioContext || null;
  }

  initialize(stream: MediaStream, audioContext: AudioContext): void {
    this.audioContext = audioContext;
    
    // Create audio analysis nodes
    const source = audioContext.createMediaStreamSource(stream);
    this.analyserNode = audioContext.createAnalyser();
    
    // Configure analyzer
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    
    // Connect nodes
    source.connect(this.analyserNode);
  }

  getQualityMetrics(): AudioQualityMetrics | null {
    if (!this.analyserNode || !this.dataArray) {
      return null;
    }

    // Get frequency data
    this.analyserNode.getByteFrequencyData(this.dataArray);

    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    const volume = rms / 255; // Normalize to 0-1

    // Calculate noise level (high frequency content)
    const highFreqStart = Math.floor(this.dataArray.length * 0.7);
    let highFreqSum = 0;
    for (let i = highFreqStart; i < this.dataArray.length; i++) {
      highFreqSum += this.dataArray[i];
    }
    const noiseLevel = highFreqSum / (this.dataArray.length - highFreqStart) / 255;

    // Calculate silence ratio (samples below threshold)
    const silenceThreshold = 10;
    let silentSamples = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      if (this.dataArray[i] < silenceThreshold) {
        silentSamples++;
      }
    }
    const silenceRatio = silentSamples / this.dataArray.length;

    // Determine overall quality
    let quality: AudioQualityMetrics['quality'] = 'poor';
    if (volume > 0.1 && noiseLevel < 0.3 && silenceRatio < 0.7) {
      quality = 'excellent';
    } else if (volume > 0.05 && noiseLevel < 0.5 && silenceRatio < 0.8) {
      quality = 'good';
    } else if (volume > 0.02 && noiseLevel < 0.7 && silenceRatio < 0.9) {
      quality = 'fair';
    }

    return {
      volume,
      quality,
      silenceRatio,
      noiseLevel
    };
  }

  dispose(): void {
    this.analyserNode = null;
    this.dataArray = null;
  }
}

export class ConnectionRecoveryManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  private onReconnectAttempt?: (attempt: number) => void;
  private onReconnectSuccess?: () => void;
  private onReconnectFailed?: () => void;

  constructor(options?: {
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    maxReconnectDelay?: number;
    onReconnectAttempt?: (attempt: number) => void;
    onReconnectSuccess?: () => void;
    onReconnectFailed?: () => void;
  }) {
    if (options) {
      this.maxReconnectAttempts = options.maxReconnectAttempts ?? this.maxReconnectAttempts;
      this.reconnectDelay = options.reconnectDelay ?? this.reconnectDelay;
      this.maxReconnectDelay = options.maxReconnectDelay ?? this.maxReconnectDelay;
      this.onReconnectAttempt = options.onReconnectAttempt;
      this.onReconnectSuccess = options.onReconnectSuccess;
      this.onReconnectFailed = options.onReconnectFailed;
    }
  }

  attemptReconnection(reconnectFn: () => Promise<boolean>): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.onReconnectFailed?.();
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      this.onReconnectAttempt?.(this.reconnectAttempts);

      try {
        const success = await reconnectFn();
        if (success) {
          console.log('Reconnection successful');
          this.reset();
          this.onReconnectSuccess?.();
        } else {
          console.log('Reconnection failed, will retry...');
          this.attemptReconnection(reconnectFn);
        }
      } catch (error) {
        console.error('Reconnection error:', error);
        this.attemptReconnection(reconnectFn);
      }
    }, delay);
  }

  reset(): void {
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  cancel(): void {
    this.reset();
    this.onReconnectFailed?.();
  }

  isReconnecting(): boolean {
    return this.reconnectTimer !== null;
  }

  getAttemptCount(): number {
    return this.reconnectAttempts;
  }
}

// Utility functions for audio format conversion
export const convertAudioFormat = async (
  audioBuffer: ArrayBuffer, 
  fromFormat: string, 
  toFormat: string = 'wav'
): Promise<ArrayBuffer> => {
  // For now, return the original buffer
  // In a full implementation, you'd use Web Audio API or a library like ffmpeg.wasm
  console.log(`Audio format conversion from ${fromFormat} to ${toFormat} requested`);
  return audioBuffer;
};

export const optimizeAudioForTranscription = async (
  stream: MediaStream,
  options: {
    sampleRate?: number;
    channels?: number;
    bitRate?: number;
  } = {}
): Promise<MediaStream> => {
  const {
    sampleRate = 16000,
    channels = 1,
    bitRate = 16000
  } = options;

  // Create audio context
  const audioContext = new AudioContext({ sampleRate });
  const source = audioContext.createMediaStreamSource(stream);

  // Create processors for optimization
  const compressor = audioContext.createDynamicsCompressor();
  const filter = audioContext.createBiquadFilter();
  const gainNode = audioContext.createGain();
  
  // Configure compressor for voice
  compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
  compressor.knee.setValueAtTime(30, audioContext.currentTime);
  compressor.ratio.setValueAtTime(12, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
  compressor.release.setValueAtTime(0.25, audioContext.currentTime);

  // Configure high-pass filter to remove low-frequency noise
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(80, audioContext.currentTime);

  // Configure gain
  gainNode.gain.setValueAtTime(1.2, audioContext.currentTime);

  // Create destination for output stream
  const destination = audioContext.createMediaStreamDestination();

  // Connect the audio processing chain
  source
    .connect(filter)
    .connect(compressor)
    .connect(gainNode)
    .connect(destination);

  return destination.stream;
};

export const detectSpeechActivity = (
  audioData: Uint8Array,
  options: {
    threshold?: number;
    windowSize?: number;
  } = {}
): boolean => {
  const { threshold = 0.01, windowSize = 1024 } = options;
  
  // Calculate RMS energy
  let sum = 0;
  const samples = Math.min(audioData.length, windowSize);
  
  for (let i = 0; i < samples; i++) {
    const sample = (audioData[i] - 128) / 128; // Convert to [-1, 1] range
    sum += sample * sample;
  }
  
  const rms = Math.sqrt(sum / samples);
  return rms > threshold;
};