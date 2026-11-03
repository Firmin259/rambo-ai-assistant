const express = require('express');
require('dotenv').config();

const app = express();

// ==========================================
// UNBREAKABLE CORS & GLOBAL PREFLIGHT CATCHER
// ==========================================
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = process.env.PORT || 5000;

// Safe SDK Initialization
let ai = null;
try {
  const { GoogleGenAI } = require('@google/genai');
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('GoogleGenAI SDK initialized successfully.');
  } else {
    console.warn('WARNING: GEMINI_API_KEY is missing from environment variables!');
  }
} catch (err) {
  console.error('Critical Error loading @google/genai:', err.message);
}

// Health check
app.get('/', (req, res) => {
  res.status(200).send('Rambo AI Backend is live and running!');
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'AI SDK not initialized. Check Render environment variables for GEMINI_API_KEY.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const { messages, systemInstruction } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages payload' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const history = messages.slice(0, -1).map(msg => {
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.mediaUrl) {
        const matches = msg.mediaUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts
      };
    });

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction || "You are a helpful AI assistant.",
      },
      history: history
    });

    const latestMsgObj = messages[messages.length - 1];
    const latestParts = [];
    if (latestMsgObj.content) latestParts.push(latestMsgObj.content);
    if (latestMsgObj.mediaUrl) {
      const matches = latestMsgObj.mediaUrl.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        latestParts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    const responseStream = await chat.sendMessageStream({ message: latestParts });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Backend Chat Error:', error);
    // If headers are already sent for stream, write stream error; otherwise send JSON
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Server processing failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || 'API stream failed' })}\n\n`);
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});