// Vercel serverless function: POST /api/ai-chat
// Proxies chat requests to Radox AI (OpenAI-compatible) so the API key
// stays server-side and is never exposed to browsers.
const RADOX_URL = 'https://radoxai.com/v1/chat/completions';
const MODEL = 'claude-fable-5';

const SYSTEM_PROMPT = `You are Tapanan AI, the friendly assistant inside the Tapanan streaming site (movies, TV shows, anime, K-dramas, Chinese anime). \
Help visitors decide what to watch: recommend titles, explain plots briefly, compare options, answer questions about genres, cast, or where to find something on the site. \
Keep answers short (under 120 words), casual, and fun. You can reply in the same language the user uses (English or Tagalog). \
If asked about something unrelated to movies/shows, answer briefly and steer back to watching recommendations.`;

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

  const key = process.env.RADOX_API_KEY;
  if (!key) {
    return json(res, 503, { error: 'AI is not configured yet. Please add your Radox API key.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'Bad JSON' }); }
  }
  const msgs = Array.isArray(body && body.messages) ? body.messages : [];
  if (!msgs.length) return json(res, 400, { error: 'No messages' });

  // Keep it cheap and safe: last 10 turns, trimmed input.
  const history = msgs
    .slice(-10)
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!history.length || history[history.length - 1].role !== 'user') {
    return json(res, 400, { error: 'Last message must be from the user' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(RADOX_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        temperature: 0.7,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || 'AI request failed';
      return json(res, r.status === 402 ? 402 : 502, { error: msg });
    }
    const reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || '').trim()
      : '';
    if (!reply) return json(res, 502, { error: 'Empty AI response' });
    return json(res, 200, { reply });
  } catch (e) {
    return json(res, 504, { error: 'AI timed out, try again.' });
  } finally {
    clearTimeout(timer);
  }
};
