import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeepgramStreamingOptions {
  model?: string;
  language?: string;
  interim_results?: boolean;
  punctuate?: boolean;
  smart_format?: boolean;
  diarize?: boolean;
  channels?: number;
  sample_rate?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY is not set');
    }

    // Check if this is a WebSocket upgrade request
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket connection", { status: 400 });
    }

    // Extract query parameters for Deepgram configuration
    const url = new URL(req.url);
    const options: DeepgramStreamingOptions = {
      model: url.searchParams.get('model') || 'nova-2',
      language: url.searchParams.get('language') || 'en-US',
      interim_results: url.searchParams.get('interim_results') === 'true',
      punctuate: url.searchParams.get('punctuate') === 'true',
      smart_format: url.searchParams.get('smart_format') === 'true',
      diarize: url.searchParams.get('diarize') === 'true',
      channels: parseInt(url.searchParams.get('channels') || '1'),
      sample_rate: parseInt(url.searchParams.get('sample_rate') || '16000'),
    };

    console.log('Establishing WebSocket proxy with options:', options);

    // Upgrade to WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // Create connection to Deepgram
    let deepgramSocket: WebSocket | null = null;
    let isDeepgramConnected = false;

    const connectToDeepgram = () => {
      const deepgramUrl = new URL('wss://api.deepgram.com/v1/listen');
      
      // Add query parameters
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          deepgramUrl.searchParams.set(key, value.toString());
        }
      });

      console.log('Connecting to Deepgram:', deepgramUrl.toString());

      deepgramSocket = new WebSocket(deepgramUrl.toString(), undefined, {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        },
      });

      deepgramSocket.onopen = () => {
        console.log('Connected to Deepgram');
        isDeepgramConnected = true;
        
        // Send connection confirmation to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'ConnectionEstablished',
            data: { provider: 'deepgram', model: options.model }
          }));
        }
      };

      deepgramSocket.onmessage = (event) => {
        // Forward Deepgram responses to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          try {
            const data = JSON.parse(event.data);
            
            // Enhance the response with metadata
            const response = {
              type: 'Results',
              data,
              timestamp: new Date().toISOString(),
              provider: 'deepgram'
            };

            clientSocket.send(JSON.stringify(response));
          } catch (error) {
            console.error('Error parsing Deepgram response:', error);
          }
        }
      };

      deepgramSocket.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'Error',
            data: { message: 'Deepgram connection error', provider: 'deepgram' }
          }));
        }
      };

      deepgramSocket.onclose = (event) => {
        console.log('Deepgram connection closed:', event.code, event.reason);
        isDeepgramConnected = false;

        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'ConnectionClosed',
            data: { 
              code: event.code, 
              reason: event.reason,
              provider: 'deepgram'
            }
          }));
        }
      };
    };

    // Set up client WebSocket handlers
    clientSocket.onopen = () => {
      console.log('Client WebSocket connected');
      connectToDeepgram();
    };

    clientSocket.onmessage = (event) => {
      try {
        // Handle different message types from client
        if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'KeepAlive':
              // Send keepalive to Deepgram if connected
              if (deepgramSocket?.readyState === WebSocket.OPEN) {
                deepgramSocket.send(JSON.stringify({ type: 'KeepAlive' }));
              }
              break;
              
            case 'CloseStream':
              // Signal end of audio stream to Deepgram
              if (deepgramSocket?.readyState === WebSocket.OPEN) {
                deepgramSocket.send(JSON.stringify({ type: 'CloseStream' }));
              }
              break;
              
            default:
              console.log('Unknown message type from client:', message.type);
          }
        } else {
          // Binary audio data - forward to Deepgram
          if (deepgramSocket?.readyState === WebSocket.OPEN && isDeepgramConnected) {
            deepgramSocket.send(event.data);
          } else {
            console.warn('Received audio data but Deepgram not connected');
          }
        }
      } catch (error) {
        console.error('Error handling client message:', error);
      }
    };

    clientSocket.onerror = (error) => {
      console.error('Client WebSocket error:', error);
    };

    clientSocket.onclose = () => {
      console.log('Client WebSocket closed');
      
      // Close Deepgram connection
      if (deepgramSocket) {
        deepgramSocket.close();
        deepgramSocket = null;
      }
    };

    return response;

  } catch (error) {
    console.error('Error in realtime-transcription function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});