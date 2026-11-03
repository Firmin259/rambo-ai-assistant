const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable CORS for all routes and handle preflight explicit OPTIONS requests immediately
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Respond immediately 200 OK to all OPTIONS preflight requests
app.options('*', cors());

// Body parsers
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
    console.error('CRITICAL: GEMINI_API_KEY is missing in environment variables!');
  }
} catch (err) {
  console.error('Failed to load @google/genai package:', err.message);
}

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Rambo AI Backend is live and running!');
});

// Text & Multimodal Chat Streaming Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'AI SDK not initialized. Check Render Environment Variables for GEMINI_API_KEY.' });
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
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Server processing failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || 'API stream failed' })}\n\n`);
      res.end();
    }
  }
});

// Image Generation Endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'AI SDK not initialized on server' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    let imageUrl = null;
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/jpeg';
          imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error('Model did not return an image payload');
    }

    res.json({ imageUrl });

  } catch (error) {
    console.error('Image Generation Error:', error);
    const message = error.status === 429 
      ? 'Free tier rate limit reached for image generation. Please try again later.' 
      : (error.message || 'Failed to generate image');
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});