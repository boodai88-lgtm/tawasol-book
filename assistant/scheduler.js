/* Tawasol scheduler · appointment slots for the assistant.
   DEMO (no api in config.js): a simulated Google Calendar — clinic hours from clinic-config, a few pre-blocked slots, bookings kept in this browser (localStorage) so the demo feels real.
   LIVE (api or assistantApi set): slots come from /api/assistant/slots?minutes=50|25 (Google Calendar through the Worker) and bookings are held server-side.
   Slot length follows the service: consultation = slotMin (50), follow-up = followupMin (25). */
(function (g) {
  const cfg = () => (g.TAWASOL_CLINIC && g.TAWASOL_CLINIC.calendar) || {}, C = () => g.TAWASOL_CONFIG || {}, api = () => String(C().api || C().assistantApi || '').replace(/\/$/, '');
  const KEY = 'tw_demo_calendar', DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MON_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const pad = (n) => String(n).padStart(2, '0'), hm = (s) => s.split(':').map(Number);
  const minutesFor = (service) => (service === 'followup' ? (cfg().followupMin || 25) : (cfg().slotMin || 50));
  const store = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{"bookings":[]}'); } catch (_) { return { bookings: [] }; } }, save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
  const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  /* Deterministic "already booked" pattern so the demo calendar is never empty nor fully free. */
  const demoBusy = (dateKey, times) => times.filter((t, i) => (hash(dateKey + t) % 3 === 0) || (i === 0 && hash(dateKey) % 2 === 0));
  const label = (iso, lang) => { const d = new Date(iso), ar = lang === 'ar', h = d.getHours(), m = d.getMinutes(), time = ar ? `${h > 12 ? h - 12 : h}:${pad(m)} ${h >= 12 ? 'م' : 'ص'}` : `${h > 12 ? h - 12 : h}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`; return ar ? `${DAY_AR[d.getDay()]} ${d.getDate()} ${MON_AR[d.getMonth()]} · ${time}` : `${DAY_EN[d.getDay()]} ${d.getDate()} ${MON_EN[d.getMonth()]} · ${time}`; };
  const caches = {}; let serverDemo = false;                                   // one cache per slot length: { list, at }
  function demoSlots(days, step) {
    const c = cfg(), open = c.days || [0, 1, 2, 3, 4], [sh, sm] = hm(c.start || '10:00'), [eh, em] = hm(c.end || '18:00'), lead = c.leadHours == null ? 20 : c.leadHours; step = step || c.slotMin || 50;
    const taken = new Set(store().bookings.map((b) => b.slot)), out = [], now = Date.now(); let d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < days && out.length < 40; i++, d.setDate(d.getDate() + 1)) {
      if (!open.includes(d.getDay())) continue;
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, times = []; for (let t = sh * 60 + sm; t + step <= eh * 60 + em; t += step) times.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
      const busy = new Set(demoBusy(key, times));
      for (const t of times) { const iso = `${key}T${t}`; if (busy.has(t) || taken.has(iso) || new Date(iso).getTime() < now + lead * 3600e3) continue; out.push(iso); }
    }
    return out;
  }
  async function refresh(days, minutes) {
    days = days || 10; minutes = minutes || cfg().slotMin || 50;
    if (!api()) { caches[minutes] = { list: demoSlots(days, minutes), at: Date.now() }; return caches[minutes].list; }
    try { const r = await fetch(api() + `/api/assistant/slots?days=${days}&minutes=${minutes}`); const j = await r.json(); serverDemo = !!j.demo; caches[minutes] = { list: j.demo ? demoSlots(days, minutes) : (j.slots || []), at: Date.now() }; }
    catch (_) { serverDemo = true; caches[minutes] = caches[minutes] || { list: demoSlots(days, minutes), at: Date.now() }; }
    return caches[minutes].list;
  }
  /* Synchronous read for the assistant's chips: 2 per day across the next 3 open days (6 max). opts.service picks the slot length; a stale cache is refreshed in the background. */
  function slots(lang, opts = {}) {
    const minutes = opts.minutes || minutesFor(opts.service), c = caches[minutes];
    if (!c || Date.now() - c.at > 60e3) { refresh(10, minutes); }
    const list = c ? c.list : (api() ? (caches[cfg().slotMin || 50] || { list: [] }).list : demoSlots(10, minutes));
    const perDay = opts.perDay || 2, maxDays = opts.days || 3, byDay = {}; for (const iso of list) { const k = iso.slice(0, 10); (byDay[k] = byDay[k] || []).push(iso); }
    return Object.keys(byDay).sort().slice(0, maxDays).flatMap((k) => byDay[k].slice(0, perDay)).map((iso) => ({ id: iso, title: label(iso, lang), iso, minutes }));
  }
  function book(slot, data) { if (api() && !serverDemo) return { ok: true, server: true }; const s = store(); if (s.bookings.some((b) => b.slot === slot)) return { ok: false, taken: true }; s.bookings.push({ slot, name: data && data.name || '', service: data && data.service || '', phone: data && data.phone || '', minutes: minutesFor(data && data.service), at: new Date().toISOString(), status: 'tentative' }); save(s); for (const k in caches) delete caches[k]; return { ok: true, demo: true }; }
  function bookings() { return store().bookings.sort((a, b) => a.slot.localeCompare(b.slot)); }
  function clearDemo() { localStorage.removeItem(KEY); for (const k in caches) delete caches[k]; }
  g.TawasolScheduler = { slots, book, bookings, label, refresh, clearDemo, minutesFor, isDemo: () => !api() || serverDemo, ready: Promise.all([refresh(10, cfg().slotMin || 50), refresh(10, cfg().followupMin || 25)]) };
})(typeof globalThis !== 'undefined' ? globalThis : window);
