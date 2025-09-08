import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface TranscriptionResult {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: TranscriptionWord[];
    }>;
  };
  is_final: boolean;
  speech_final: boolean;
  duration: number;
  start: number;
}

export interface StreamingTranscriptionOptions {
  model?: 'nova-2' | 'nova-3' | 'base';
  language?: string;
  interim_results?: boolean;
  punctuate?: boolean;
  smart_format?: boolean;
  diarize?: boolean;
  channels?: number;
  sample_rate?: number;
}

export interface RealtimeTranscriptionState {
  isConnecting: boolean;
  isConnected: boolean;
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  words: TranscriptionWord[];
  error: string | null;
  connectionId: string | null;
}

export const useRealtimeTranscription = (options?: StreamingTranscriptionOptions) => {
  const [state, setState] = useState<RealtimeTranscriptionState>({
    isConnecting: false,
    isConnected: false,
    isRecording: false,
    transcript: '',
    interimTranscript: '',
    words: [],
    error: null,
    connectionId: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksBufferRef = useRef<Blob[]>([]);

  const defaultOptions: StreamingTranscriptionOptions = {
    model: 'nova-2',
    language: 'en-US',
    interim_results: true,
    punctuate: true,
    smart_format: true,
    diarize: false,
    channels: 1,
    sample_rate: 16000,
    ...options
  };

  // WebSocket connection management
  const connectWebSocket = useCallback(async () => {
    if (state.isConnecting || state.isConnected) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Build query parameters
      const params = new URLSearchParams({
        model: defaultOptions.model!,
        language: defaultOptions.language!,
        interim_results: defaultOptions.interim_results!.toString(),
        punctuate: defaultOptions.punctuate!.toString(),
        smart_format: defaultOptions.smart_format!.toString(),
        diarize: defaultOptions.diarize!.toString(),
        channels: defaultOptions.channels!.toString(),
        sample_rate: defaultOptions.sample_rate!.toString(),
      });

      // Connect through our Supabase Edge Function (acts as proxy to Deepgram)
      const wsUrl = `${import.meta.env.VITE_SUPABASE_URL?.replace('https', 'wss')}/functions/v1/realtime-transcription?${params}`;
      
      wsRef.current = new WebSocket(wsUrl, [
        'token',
        import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      ]);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        setState(prev => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
          connectionId
        }));

        // Start keep-alive interval (send every 8 seconds)
        keepAliveIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 8000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'Results') {
            const result: TranscriptionResult = message.data;
            
            if (result.is_final) {
              // Final transcription result
              setState(prev => ({
                ...prev,
                transcript: prev.transcript + ' ' + result.channel.alternatives[0].transcript,
                interimTranscript: '',
                words: [...prev.words, ...result.channel.alternatives[0].words]
              }));
            } else {
              // Interim result
              setState(prev => ({
                ...prev,
                interimTranscript: result.channel.alternatives[0].transcript
              }));
            }
          } else if (message.type === 'Metadata') {
            console.log('Transcription metadata:', message.data);
          } else if (message.type === 'SpeechStarted') {
            console.log('Speech started detected');
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnecting: false,
          isConnected: false
        }));
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isRecording: false,
          connectionId: null
        }));

        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to establish connection',
        isConnecting: false
      }));
    }
  }, [defaultOptions, state.isConnecting, state.isConnected]);

  // Audio recording management
  const startRecording = useCallback(async () => {
    if (!state.isConnected) {
      await connectWebSocket();
      return;
    }

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: defaultOptions.sample_rate,
          channelCount: defaultOptions.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Create MediaRecorder for chunked audio capture
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksBufferRef.current = [];

      // Send audio chunks as they become available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert blob to ArrayBuffer and send
          event.data.arrayBuffer().then(buffer => {
            wsRef.current?.send(buffer);
          });
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setState(prev => ({
          ...prev,
          error: 'Recording error occurred'
        }));
      };

      // Start recording with small time slices for low latency
      mediaRecorder.start(100); // 100ms chunks for optimal performance

      setState(prev => ({
        ...prev,
        isRecording: true,
        error: null
      }));

      toast.success('Started real-time transcription');

    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to access microphone'
      }));
      toast.error('Failed to access microphone');
    }
  }, [state.isConnected, connectWebSocket, defaultOptions]);

  const stopRecording = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Send close message to WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
    }

    setState(prev => ({
      ...prev,
      isRecording: false
    }));

    toast.info('Stopped real-time transcription');
  }, []);

  const disconnect = useCallback(() => {
    stopRecording();

    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      connectionId: null
    }));
  }, [stopRecording]);

  const clearTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      words: []
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect: connectWebSocket,
    startRecording,
    stopRecording,
    disconnect,
    clearTranscript,
    fullTranscript: state.transcript + (state.interimTranscript ? ' ' + state.interimTranscript : '')
  };
};