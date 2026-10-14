// Render web service entrypoint: serves the static site + /api/ai-chat.
// The ai-chat handler is written Vercel-style (req, res) and works here
// unchanged because Express res supports .status()/.setHeader()/.end().
const path = require('path');
const express = require('express');
const aiChat = require('./api/ai-chat.js');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/ai-chat', (req, res) => aiChat(req, res));

app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA/hash fallback: always serve index.html for unknown non-API routes.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log('Tapanan listening on :' + port));
