const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ==========================================
// 1. CORS CONFIGURATION
// ==========================================

const allowedOrigins = [
  'https://rambo-ai-assistant.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {

    // Allow requests without an Origin header
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('Blocked CORS origin:', origin);

    return callback(null, false);
  },

  methods: [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With'
  ],

  credentials: true,
  optionsSuccessStatus: 204
};

// Apply CORS before all routes
app.use(cors(corsOptions));

// Explicitly handle preflight requests.
// No wildcard route is necessary: cors middleware
// already handles OPTIONS requests globally.

// ==========================================
// 2. BODY PARSERS
// ==========================================

app.use(express.json({
  limit: '50mb'
}));

app.use(express.urlencoded({
  limit: '50mb',
  extended: true
}));

// ==========================================
// 3. SERVER PORT
// ==========================================

const PORT = process.env.PORT || 5000;

// ==========================================
// 4. GEMINI AI INITIALIZATION
// ==========================================

let ai = null;

try {

  const { GoogleGenAI } = require('@google/genai');

  if (process.env.GEMINI_API_KEY) {

    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    console.log(
      'GoogleGenAI SDK initialized successfully.'
    );

  } else {

    console.error(
      'CRITICAL: GEMINI_API_KEY is missing in environment variables!'
    );

  }

} catch (err) {

  console.error(
    'Failed to load @google/genai package:',
    err.message
  );

}

// ==========================================
// 5. HEALTH CHECK ENDPOINT
// ==========================================

app.get('/', (req, res) => {

  res.status(200).send(
    'Rambo AI Backend is live and running!'
  );

});

// ==========================================
// 6. CHAT STREAMING ENDPOINT
// ==========================================

app.post('/api/chat', async (req, res) => {

  try {

    // Check Gemini initialization
    if (!ai) {

      return res.status(500).json({
        error: 'AI SDK not initialized. Check Render Environment Variables for GEMINI_API_KEY.'
      });

    }

    // Bearer token check
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {

      return res.status(401).json({
        error: 'Unauthorized: No token provided'
      });

    }

    // Read request body
    const {
      messages,
      systemInstruction
    } = req.body;

    if (
      !messages ||
      !Array.isArray(messages) ||
      messages.length === 0
    ) {

      return res.status(400).json({
        error: 'Invalid messages payload'
      });

    }

    // Convert previous messages into Gemini history
    const history = messages.slice(0, -1).map(msg => {

      const parts = [];

      if (msg.content) {

        parts.push({
          text: msg.content
        });

      }

      if (msg.mediaUrl) {

        const matches = msg.mediaUrl.match(
          /^data:(.+);base64,(.+)$/
        );

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

    // Create Gemini chat
    const chat = ai.chats.create({

      model: 'gemini-2.5-flash',

      config: {

        systemInstruction:
          systemInstruction ||
          'You are a helpful AI assistant.'

      },

      history: history

    });

    // Get latest message
    const latestMsgObj = messages[messages.length - 1];

    const latestParts = [];

    if (latestMsgObj.content) {

      latestParts.push({
        text: latestMsgObj.content
      });

    }

    if (latestMsgObj.mediaUrl) {

      const matches = latestMsgObj.mediaUrl.match(
        /^data:(.+);base64,(.+)$/
      );

      if (matches) {

        latestParts.push({

          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }

        });

      }

    }

    if (latestParts.length === 0) {

      return res.status(400).json({
        error: 'Latest message must contain text or valid media'
      });

    }

    // Start SSE response
    res.setHeader(
      'Content-Type',
      'text/event-stream'
    );

    res.setHeader(
      'Cache-Control',
      'no-cache, no-transform'
    );

    res.setHeader(
      'Connection',
      'keep-alive'
    );

    res.flushHeaders?.();

    // Generate streaming response
    const responseStream = await chat.sendMessageStream({
      message: latestParts
    });

    for await (const chunk of responseStream) {

      // Stop if client disconnects
      if (res.destroyed) {
        break;
      }

      if (chunk.text) {

        res.write(
          `data: ${JSON.stringify({
            text: chunk.text
          })}\n\n`
        );

      }

    }

    // Finish stream
    if (!res.destroyed) {

      res.write('data: [DONE]\n\n');

      res.end();

    }

  } catch (error) {

    console.error(
      'Backend Chat Error:',
      error
    );

    if (!res.headersSent) {

      res.status(500).json({

        error:
          error.message ||
          'Server processing failed'

      });

    } else if (!res.destroyed) {

      res.write(
        `data: ${JSON.stringify({
          error:
            error.message ||
            'API stream failed'
        })}\n\n`
      );

      res.end();

    }

  }

});

// ==========================================
// 7. IMAGE GENERATION ENDPOINT
// ==========================================

app.post('/api/generate-image', async (req, res) => {

  try {

    // Check Gemini initialization
    if (!ai) {

      return res.status(500).json({
        error: 'AI SDK not initialized on server'
      });

    }

    // Bearer token check
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {

      return res.status(401).json({
        error: 'Unauthorized: No token provided'
      });

    }

    // Get image prompt
    const { prompt } = req.body;

    if (
      !prompt ||
      typeof prompt !== 'string' ||
      !prompt.trim()
    ) {

      return res.status(400).json({
        error: 'Prompt is required'
      });

    }

    console.log(
      'Image generation request received.'
    );

    // Generate image using Gemini
    const response = await ai.models.generateContent({

      model: 'gemini-2.5-flash-image',

      contents: prompt,

      config: {
        responseModalities: ['TEXT', 'IMAGE']
      }

    });

    let imageUrl = null;

    let generatedText = '';

    if (
      response.candidates &&
      response.candidates[0]?.content?.parts
    ) {

      for (
        const part of response.candidates[0].content.parts
      ) {

        if (part.text) {

          generatedText += part.text;

        }

        if (
          part.inlineData &&
          part.inlineData.data
        ) {

          const mimeType =
            part.inlineData.mimeType || 'image/jpeg';

          imageUrl =
            `data:${mimeType};base64,${part.inlineData.data}`;

          break;

        }

      }

    }

    if (!imageUrl) {

      throw new Error(
        'Model did not return an image payload'
      );

    }

    // Return generated image
    return res.status(200).json({

      imageUrl: imageUrl,
      text: generatedText

    });

  } catch (error) {

    console.error(
      'Image Generation Error:',
      error
    );

    const message = error.status === 429

      ? 'Free tier rate limit reached for image generation. Please try again later.'

      : (
          error.message ||
          'Failed to generate image'
        );

    return res.status(500).json({

      error: message

    });

  }

});

// ==========================================
// 8. 404 HANDLER
// ==========================================

app.use((req, res) => {

  res.status(404).json({

    error: 'Route not found',
    path: req.originalUrl

  });

});

// ==========================================
// 9. GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {

  console.error(
    'Server Error:',
    err.message
  );

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({

    error: 'Internal server error'

  });

});

// ==========================================
// 10. START SERVER
// ==========================================

app.listen(PORT, () => {

  console.log('====================================');

  console.log(
    'RAMBO AI BACKEND STARTED SUCCESSFULLY'
  );

  console.log('====================================');

  console.log(`PORT: ${PORT}`);

  console.log(
    `GEMINI AI: ${ai ? 'INITIALIZED' : 'NOT INITIALIZED'}`
  );

  console.log(
    'CORS: CONFIGURED'
  );

  console.log('====================================');

});
