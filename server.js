// ============================================================================
// CUSTOM SERVER WITH WEBSOCKET SUPPORT
// ============================================================================
// Relay server for OpenAI Realtime API (browser cannot connect directly)

// Load environment variables from .env.local (Next.js does this automatically, but custom server doesn't)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' }); // Fallback to .env

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001; // Separate port for WebSocket relay
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Debug: Check if API key is loaded
console.log('OPENAI_API_KEY loaded:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 10)}...` : 'NOT FOUND');

app.prepare().then(() => {
  // Main HTTP server for Next.js (handles HMR normally)
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Separate WebSocket server on different port (avoids HMR conflicts)
  const wsServer = createServer();
  const wss = new WebSocket.Server({ server: wsServer });

  console.log(`WebSocket relay server will be available at ws://localhost:${WS_PORT}`);

  wss.on('connection', async (clientWs, req) => {
    const connectionId = Date.now().toString(36);
    console.log(`[${connectionId}] Client connected to WebSocket relay`);

    // Parse query parameters for session config
    const url = new URL(req.url, `http://localhost:${WS_PORT}`);
    const characterId = url.searchParams.get('characterId');
    const sessionConfigBase64 = url.searchParams.get('sessionConfig');

    let sessionConfig = null;
    try {
      if (sessionConfigBase64) {
        sessionConfig = JSON.parse(Buffer.from(sessionConfigBase64, 'base64').toString('utf-8'));
      }
    } catch (e) {
      console.error('Failed to parse session config:', e);
    }

    console.log(`[${connectionId}] Relay params:`, { characterId, hasSessionConfig: !!sessionConfig });
    console.log(`[${connectionId}] Client readyState:`, clientWs.readyState);

    // Check API key
    if (!OPENAI_API_KEY) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: { message: 'OpenAI API key not configured on server' },
      }));
      clientWs.close();
      return;
    }

    // Connect to OpenAI Realtime API
    const openaiWsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
    
    let openaiWs;
    try {
      openaiWs = new WebSocket(openaiWsUrl, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });
    } catch (e) {
      console.error('Failed to create OpenAI WebSocket:', e);
      clientWs.send(JSON.stringify({
        type: 'error',
        error: { message: 'Failed to connect to OpenAI Realtime API' },
      }));
      clientWs.close();
      return;
    }

    // OpenAI connection established
    openaiWs.on('open', () => {
      console.log(`[${connectionId}] Connected to OpenAI Realtime API`);
      console.log(`[${connectionId}] Client readyState at OpenAI open:`, clientWs.readyState);
      
      // Check if client is still connected
      if (clientWs.readyState !== WebSocket.OPEN) {
        console.log(`[${connectionId}] ⚠️ Client already disconnected! Closing OpenAI connection.`);
        openaiWs.close();
        return;
      }
      
      // Send session configuration if provided
      if (sessionConfig) {
        const sessionUpdate = {
          type: 'session.update',
          session: sessionConfig,
        };
        openaiWs.send(JSON.stringify(sessionUpdate));
        console.log(`[${connectionId}] Sent session configuration to OpenAI`);
      }

      // Notify client that relay is ready
      try {
        clientWs.send(JSON.stringify({
          type: 'relay.connected',
        }));
        console.log(`[${connectionId}] Sent relay.connected to client`);
      } catch (e) {
        console.error(`[${connectionId}] Failed to send relay.connected:`, e.message);
      }
    });

    // Forward messages from OpenAI to client
    openaiWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`[${connectionId}] OpenAI -> Client:`, msg.type);
        
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data.toString());
        } else {
          console.log(`[${connectionId}] ⚠️ Cannot forward, client readyState:`, clientWs.readyState);
        }
      } catch (e) {
        console.error(`[${connectionId}] Error forwarding message to client:`, e);
      }
    });

    openaiWs.on('error', (error) => {
      console.error('OpenAI WebSocket error:', error.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: { message: `OpenAI connection error: ${error.message}` },
        }));
      }
    });

    openaiWs.on('close', (code, reason) => {
      console.log(`[${connectionId}] OpenAI WebSocket closed:`, code, reason?.toString() || '(no reason)');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    // Forward messages from client to OpenAI
    clientWs.on('message', (data) => {
      try {
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(data.toString());
        }
      } catch (e) {
        console.error('Error forwarding message to OpenAI:', e);
      }
    });

    clientWs.on('close', (code, reason) => {
      console.log(`[${connectionId}] Client WebSocket closed:`, code, reason?.toString() || '(no reason)');
      console.log(`[${connectionId}] OpenAI readyState at client close:`, openaiWs.readyState);
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });

    clientWs.on('error', (error) => {
      console.error('Client WebSocket error:', error.message);
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    });
  });

  // Start Next.js server
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Next.js ready on http://localhost:${PORT}`);
  });

  // Start WebSocket relay server on separate port
  wsServer.listen(WS_PORT, (err) => {
    if (err) throw err;
    console.log(`> WebSocket relay available at ws://localhost:${WS_PORT}`);
  });
});

