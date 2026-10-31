// Tawasol assistant · stand-alone Cloudflare Worker (single file, no database) so the website chat can use Claude before the full backend is deployed.
// Deploy in 5 minutes: Cloudflare dashboard → Workers & Pages → Create → "Hello World" → Edit code → paste this file → Deploy.
// Settings → Variables: add secret ANTHROPIC_API_KEY; vars ALLOWED_ORIGINS (e.g. "https://boodai88-lgtm.github.io"), optional ENQUIRY_WEBHOOK_URL (n8n / Make / Zapier webhook that receives bookings, questions and clinical requests as JSON).
// Then in web/config.js set assistantApi: "https://<worker-name>.<account>.workers.dev".
const MODEL = 'claude-sonnet-4-5', MAX_TOKENS = 700, PER_MIN = 20;
const hits = new Map();                                   // per-isolate rate limit (good enough for a test phase)
const cors = (origin) => ({ 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' });
const json = (o, status, origin) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...cors(origin) } });
export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '', allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.length ? allowed.includes(origin) : true, url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(okOrigin ? origin : '') });
    if (!okOrigin) return json({ error: 'origin not allowed' }, 403, '');
    const ip = req.headers.get('cf-connecting-ip') || 'x', m = Math.floor(Date.now() / 60000), k = ip + ':' + m; hits.set(k, (hits.get(k) || 0) + 1); if (hits.size > 5000) hits.clear();
    if (hits.get(k) > PER_MIN) return json({ error: 'Too many requests — please wait a minute.' }, 429, origin);
    if (req.method === 'POST' && url.pathname === '/api/assistant/complete') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set on the worker' }, 500, origin);
      const b = await req.json().catch(() => ({})), system = String(b.system || '');
      if (!/virtual receptionist/i.test(system) || !/Tawasol/i.test(system)) return json({ error: 'not a Tawasol request' }, 400, origin);   // the key only serves the clinic assistant
      const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-24).map((x) => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: String(x.content || '').slice(0, 4000) }));
      if (!messages.length) return json({ error: 'empty' }, 400, origin);
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: env.MODEL || MODEL, max_tokens: Math.min(MAX_TOKENS, +b.max_tokens || MAX_TOKENS), system: system.slice(0, 12000), messages }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) return json({ error: j.error?.message || 'LLM error ' + r.status }, 502, origin);
      return json({ text: (j.content || []).map((c) => c.text || '').join('') }, 200, origin);
    }
    if (req.method === 'POST' && url.pathname === '/api/assistant/requests') {
      const b = await req.json().catch(() => ({}));
      if (env.ENQUIRY_WEBHOOK_URL) { try { await fetch(env.ENQUIRY_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ received_at: new Date().toISOString(), source: 'tawasol-website', ...b }) }); } catch (e) { console.error('webhook', e.message); } }
      else console.log('ENQUIRY', JSON.stringify(b).slice(0, 2000));                  // visible in the worker's live logs until a webhook is set
      return json({ ok: true, forwarded: !!env.ENQUIRY_WEBHOOK_URL }, 200, origin);
    }
    if (req.method === 'GET' && url.pathname === '/api/assistant/slots') return json({ slots: [], demo: true }, 200, origin);   // demo calendar stays in the browser in this phase
    return json({ ok: true, service: 'tawasol-assistant' }, 200, origin);
  },
};
