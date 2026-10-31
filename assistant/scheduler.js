/* Tawasol scheduler · appointment slots for the assistant.
   DEMO (no api in config.js): a simulated Google Calendar — clinic hours from clinic-config, a few pre-blocked slots, bookings kept in this browser (localStorage) so the demo feels real.
   LIVE (api set): slots come from /api/assistant/slots (Google Calendar free/busy through the Worker) and bookings are created server-side. */
(function (g) {
  const cfg = () => (g.TAWASOL_CLINIC && g.TAWASOL_CLINIC.calendar) || {}, C = () => g.TAWASOL_CONFIG || {}, api = () => String(C().api || '').replace(/\/$/, '');   // the demo calendar stays local until the FULL backend (api) exists; assistantApi alone does not change it
  const KEY = 'tw_demo_calendar', DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MON_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const pad = (n) => String(n).padStart(2, '0'), hm = (s) => s.split(':').map(Number);
  const store = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{"bookings":[]}'); } catch (_) { return { bookings: [] }; } }, save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
  const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  /* Deterministic "already booked" pattern so the demo calendar is never empty nor fully free. */
  const demoBusy = (dateKey, times) => times.filter((t, i) => (hash(dateKey + t) % 3 === 0) || (i === 0 && hash(dateKey) % 2 === 0));
  const label = (iso, lang) => { const d = new Date(iso), ar = lang === 'ar', h = d.getHours(), m = d.getMinutes(), time = ar ? `${h > 12 ? h - 12 : h}:${pad(m)} ${h >= 12 ? 'م' : 'ص'}` : `${h > 12 ? h - 12 : h}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`; return ar ? `${DAY_AR[d.getDay()]} ${d.getDate()} ${MON_AR[d.getMonth()]} · ${time}` : `${DAY_EN[d.getDay()]} ${d.getDate()} ${MON_EN[d.getMonth()]} · ${time}`; };
  let cache = null, cacheAt = 0;
  function demoSlots(days) {
    const c = cfg(), open = c.days || [0, 1, 2, 3, 4], [sh, sm] = hm(c.start || '10:00'), [eh, em] = hm(c.end || '18:00'), step = c.slotMin || 50, lead = c.leadHours == null ? 20 : c.leadHours;
    const taken = new Set(store().bookings.map((b) => b.slot)), out = [], now = Date.now(); let d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < days && out.length < 40; i++, d.setDate(d.getDate() + 1)) {
      if (!open.includes(d.getDay())) continue;
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, times = []; for (let t = sh * 60 + sm; t + step <= eh * 60 + em; t += step) times.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
      const busy = new Set(demoBusy(key, times));
      for (const t of times) { const iso = `${key}T${t}`; if (busy.has(t) || taken.has(iso) || new Date(iso).getTime() < now + lead * 3600e3) continue; out.push(iso); }
    }
    return out;
  }
  async function refresh(days) { if (!api()) { cache = demoSlots(days || 10); cacheAt = Date.now(); return cache; } try { const r = await fetch(api() + `/api/assistant/slots?days=${days || 10}`); const j = await r.json(); cache = j.slots || []; cacheAt = Date.now(); } catch (_) { cache = cache || []; } return cache; }
  /* Synchronous read for the assistant's chips: 2 per day across the next 3 open days (6 max), so the choice stays short. Falls back to a fresh demo computation. */
  function slots(lang, opts = {}) { const list = cache && Date.now() - cacheAt < 60e3 ? cache : (api() ? cache || [] : (cache = demoSlots(10))); const perDay = opts.perDay || 2, maxDays = opts.days || 3, byDay = {}; for (const iso of list) { const k = iso.slice(0, 10); (byDay[k] = byDay[k] || []).push(iso); } return Object.keys(byDay).sort().slice(0, maxDays).flatMap((k) => byDay[k].slice(0, perDay)).map((iso) => ({ id: iso, title: label(iso, lang), iso })); }
  function book(slot, data) { if (api()) return { ok: true, server: true }; const s = store(); if (s.bookings.some((b) => b.slot === slot)) return { ok: false, taken: true }; s.bookings.push({ slot, name: data && data.name || '', service: data && data.service || '', phone: data && data.phone || '', at: new Date().toISOString(), status: 'tentative' }); save(s); cache = null; return { ok: true, demo: true }; }
  function bookings() { return store().bookings.sort((a, b) => a.slot.localeCompare(b.slot)); }
  function clearDemo() { localStorage.removeItem(KEY); cache = null; }
  g.TawasolScheduler = { slots, book, bookings, label, refresh, clearDemo, isDemo: () => !api(), ready: refresh(10) };
})(typeof globalThis !== 'undefined' ? globalThis : window);
