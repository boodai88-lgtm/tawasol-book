// Tawasol assistant · stand-alone Cloudflare Worker (single file, no database) so the website chat can use Claude before the full backend is deployed.
// Deploy in 5 minutes: Cloudflare dashboard → Workers & Pages → Create → "Hello World" → Edit code → paste this file → Deploy.
// Settings → Variables: secret ANTHROPIC_API_KEY; vars ALLOWED_ORIGINS (e.g. "https://boodai88-lgtm.github.io"), optional ENQUIRY_WEBHOOK_URL (n8n / Make / Zapier webhook that receives bookings, questions and clinical requests as JSON).
// Google Calendar + Inbox sheet (no Google Cloud needed): deploy api/google-calendar-bridge.gs inside the clinic Google account, then set
//   GCAL_BRIDGE_URL (the web-app URL ending in /exec) and secret GCAL_BRIDGE_SECRET (the same SECRET as in the script).
//   Clinic hours (Juana, 4 Nov 2026): Sunday, Monday, Wednesday 15:00–19:30 — CLINIC_DAYS "0,1,3" (0=Sunday), CLINIC_START "15:00", CLINIC_END "19:30". Free times inside these hours are offered;
//   every calendar event blocks time. Optional: events titled OPEN narrow the offer to those windows. Slot lengths SLOT_MIN "50" (consultation), FOLLOWUP_MIN "25" (follow-up); LEAD_HOURS "20" = earliest offer.
//   Preferred control for the team: events titled "OPEN" in the clinic calendar (e.g. OPEN 16:00–20:00, repeating weekly) — when any exist in the
//   next ~10 days, times are offered ONLY inside them; every other event blocks time. Delete the OPEN events to return to the grid.
// Then in web/config.js set assistantApi: "https://<worker-name>.<account>.workers.dev".
const MODEL = 'claude-sonnet-4-5', MAX_TOKENS = 700, PER_MIN = 20;
const hits = new Map();                                   // per-isolate rate limit (good enough for a test phase)
const cors = (origin) => ({ 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'origin' });
const json = (o, status, origin) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...cors(origin) } });
const bridgeOn = (env) => !!(env.GCAL_BRIDGE_URL && env.GCAL_BRIDGE_SECRET);
async function bridge(env, action, payload = {}) {
  const r = await fetch(env.GCAL_BRIDGE_URL, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: env.GCAL_BRIDGE_SECRET, action, ...payload }) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { throw new Error('bridge replied ' + r.status + ' — is the web app deployed with access "Anyone"?'); }
  if (!j.ok) throw new Error(j.error || 'bridge failed'); return j;
}
/* Offered times = OPEN windows (if the calendar has any) or the clinic grid, minus busy periods and the lead time. Slots are clinic-local strings "YYYY-MM-DDTHH:MM" (Asia/Kuwait, UTC+3). */
const minutesFor = (env, service, override) => { const n = +override; if (n >= 15 && n <= 120) return n; return service === 'followup' ? (+env.FOLLOWUP_MIN || 25) : (+env.SLOT_MIN || 50); };
function gridSlots(busy, env, days, open = [], step) {
  step = step || +env.SLOT_MIN || 50;
  const lead = env.LEAD_HOURS == null ? 20 : +env.LEAD_HOURS, pad = (n) => String(n).padStart(2, '0'), out = [];
  const local = (ms) => { const d = new Date(ms + 3 * 3600e3); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const free = (s, e) => s >= Date.now() + lead * 3600e3 && !busy.some(([bs, be]) => s < be && e > bs);
  if (open.length) { for (const [ws, we] of open) for (let s = ws; s + step * 60e3 <= we; s += step * 60e3) if (free(s, s + step * 60e3)) out.push(local(s)); return [...new Set(out)].sort(); }
  const days0 = String(env.CLINIC_DAYS || '0,1,3').split(',').map(Number), [sh, sm] = String(env.CLINIC_START || '15:00').split(':').map(Number), [eh, em] = String(env.CLINIC_END || '19:30').split(':').map(Number);
  for (let d = 0; d <= days; d++) {
    const day = new Date(Date.now() + 3 * 3600e3 + d * 864e5), y = day.getUTCFullYear(), mo = day.getUTCMonth() + 1, da = day.getUTCDate(); if (!days0.includes(day.getUTCDay())) continue;
    for (let t = sh * 60 + sm; t + step <= eh * 60 + em; t += step) {
      const l = `${y}-${pad(mo)}-${pad(da)}T${pad(Math.floor(t / 60))}:${pad(t % 60)}`, s = Date.parse(l + ':00+03:00');
      if (free(s, s + step * 60e3)) out.push(l);
    }
  }
  return out;
}
export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '', allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.length ? (allowed.includes(origin) || (!origin && req.method === 'GET')) : true, url = new URL(req.url);   // GET with no origin = someone opening a check URL in a browser
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
      const b = await req.json().catch(() => ({})); let hold = null;
      if (b.kind === 'booking' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.slot || '') && bridgeOn(env)) {     // tentative HOLD in the clinic calendar
        const minutes = minutesFor(env, b.service, b.minutes), start = Date.parse(b.slot + ':00+03:00'), end = start + minutes * 60e3;
        try { hold = await bridge(env, 'hold', { start: new Date(start).toISOString(), end: new Date(end).toISOString(), title: `HOLD · ${b.name || 'New client'} · ${b.service === 'followup' ? 'Follow-up' : 'Consultation'} (${minutes} min)`, description: `Requested through the Tawasol assistant (website).\nWhatsApp: ${b.phone || '—'}\n${b.who ? 'For: ' + b.who + '\n' : ''}${b.age ? 'Age: ' + b.age + '\n' : ''}${b.mode ? 'Mode: ' + b.mode + '\n' : ''}${b.reason ? 'Reason: ' + b.reason + '\n' : ''}Status: tentative — confirm with the client, then rename or delete.` }); }
        catch (e) { console.error('calendar hold failed', e.message); hold = { error: e.message }; }
      }
      const ref = 'TW-' + Date.now().toString(36).toUpperCase().slice(-6); let inbox = null;
      if (bridgeOn(env)) {                                                                                   // durable record: Google Sheet "Tawasol — Inbox" in the clinic account
        const transcript = Array.isArray(b.transcript) ? b.transcript.map((m) => (m.who === 'bot' ? 'Tawasol' : 'Client') + ': ' + (m.text || '')).join('\n') : (b.transcript || '');
        try { inbox = await bridge(env, 'inbox', { ref, kind: b.kind, name: b.name, phone: b.phone, who: b.who, age: b.age, returning: b.returning, service: b.service, mode: b.mode, slot: b.slot, slotLabel: b.slotLabel, preferred: b.preferred, message: b.message || b.question || b.text || b.reason || '', hold: hold && hold.link ? hold.link : hold && hold.error ? 'FAILED: ' + hold.error : '', lang: b.lang, channel: b.channel || 'web', transcript }); }
        catch (e) { console.error('inbox failed', e.message); inbox = { error: e.message }; }
      }
      if (env.ENQUIRY_WEBHOOK_URL) { try { await fetch(env.ENQUIRY_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ received_at: new Date().toISOString(), source: 'tawasol-website', ref, calendar_hold: hold, ...b }) }); } catch (e) { console.error('webhook', e.message); } }
      if (!bridgeOn(env) && !env.ENQUIRY_WEBHOOK_URL) console.log('ENQUIRY', JSON.stringify({ ...b, calendar_hold: hold }).slice(0, 2000));   // last resort: worker live logs
      return json({ ok: true, ref, forwarded: !!env.ENQUIRY_WEBHOOK_URL, inbox: !!(inbox && inbox.ok), hold }, 200, origin);
    }
    if (req.method === 'GET' && url.pathname === '/api/assistant/slots') {
      if (!bridgeOn(env)) return json({ slots: [], demo: true }, 200, origin);                              // demo calendar stays in the browser until the bridge is set
      const days = Math.min(30, Math.max(1, +url.searchParams.get('days') || 10)), minutes = minutesFor(env, url.searchParams.get('service'), url.searchParams.get('minutes'));
      try { const r = await bridge(env, 'freebusy', { from: new Date().toISOString(), to: new Date(Date.now() + (days + 1) * 864e5).toISOString() }); const open = (r.open || []).map(([s, e]) => [+s, +e]); const busy = (r.busy || []).map(([s, e]) => [+s, +e]), out = { slots: gridSlots(busy, env, days, open, minutes), live: true, minutes, mode: open.length ? 'open-windows' : 'clinic-hours' };
        if (url.searchParams.get('debug') === '1') { const loc = (ms) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); Object.assign(out, { debug: { now_kuwait: loc(Date.now()), lead_hours: env.LEAD_HOURS == null ? 20 : +env.LEAD_HOURS, clinic_days: env.CLINIC_DAYS || '0,1,3 (default)', clinic_start: env.CLINIC_START || '15:00 (default)', clinic_end: env.CLINIC_END || '19:30 (default)', busy: busy.map(([s, e]) => loc(s) + ' → ' + loc(e)), open: open.map(([s, e]) => loc(s) + ' → ' + loc(e)) } }); }
        return json(out, 200, origin); }
      catch (e) { return json({ slots: [], demo: true, error: e.message }, 200, origin); }
    }
    if (req.method === 'GET' && url.pathname === '/api/assistant/inbox-check') {                         // opens/creates the inbox sheet and shows its link
      if (!bridgeOn(env)) return json({ ok: false, error: 'GCAL_BRIDGE_URL / GCAL_BRIDGE_SECRET not set' }, 200, origin);
      try { return json(await bridge(env, 'inbox_url'), 200, origin); } catch (e) { return json({ ok: false, error: e.message }, 200, origin); }
    }
    if (req.method === 'GET' && url.pathname === '/api/assistant/calendar-check') {                       // open in a browser to confirm the bridge works
      if (!bridgeOn(env)) return json({ ok: false, error: 'GCAL_BRIDGE_URL / GCAL_BRIDGE_SECRET not set' }, 200, origin);
      try { return json(await bridge(env, 'ping'), 200, origin); } catch (e) { return json({ ok: false, error: e.message }, 200, origin); }
    }
    return json({ ok: true, service: 'tawasol-assistant', calendar: bridgeOn(env) ? 'bridge' : 'demo' }, 200, origin);
  },
};
