/* Tawasol scheduler · appointment slots for the assistant.
   DEMO (no api/assistantApi in config.js — local preview only): a simulated Google Calendar — clinic hours from clinic-config, a few pre-blocked slots, bookings kept in this browser (localStorage) so the demo feels real.
   LIVE (api or assistantApi set): slots come from /api/assistant/slots?minutes=50|25 (Google Calendar through the Worker) and bookings are held server-side.
   Session length follows the service (50 / 20 min); the WORKER pads each to its calendar block (60 / 30 min) when listing free times and placing holds. */
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
    const c = cfg(), open = c.days || [0, 1, 2, 3, 4], [sh, sm] = hm(c.start || '15:00'), [eh, em] = hm(c.end || '19:30'), lead = c.leadHours == null ? 20 : c.leadHours; step = step || c.slotMin || 50;
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
    // LIVE: whatever the worker returns is the truth. No OPEN events (or calendar not connected / unreachable) → an empty list, never invented hours; the assistant then asks for a preferred time and the team arranges it.
    try { const r = await fetch(api() + `/api/assistant/slots?days=${days}&minutes=${minutes}`); const j = await r.json(); serverDemo = !!j.demo; caches[minutes] = { list: j.slots || [], at: Date.now() }; }
    catch (_) { serverDemo = true; caches[minutes] = caches[minutes] || { list: [], at: Date.now() }; }
    return caches[minutes].list;
  }
  /* Preference parser: weekdays, periods of the day, explicit hours, today/tomorrow/next week, a date like 12/11 or 12 Nov (EN + AR). Returns null when nothing recognisable. */
  const DAYS_RE = [/\b(sun|sunday)\b|الأحد|الاحد/i, /\b(mon|monday)\b|الاثنين|الإثنين|الأثنين/i, /\b(tue|tues|tuesday)\b|الثلاثاء|الثلاثا/i, /\b(wed|wednesday)\b|الأربعاء|الاربعاء|الاربعا/i, /\b(thu|thur|thurs|thursday)\b|الخميس/i, /\b(fri|friday)\b|الجمعة|الجمعه/i, /\b(sat|saturday)\b|السبت/i];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function parsePreference(text) {
    const t = String(text || '').toLowerCase().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), p = { days: [], ranges: [], dates: [], any: false };
    if (/\b(any|anytime|whenever|earliest|soonest|asap|first available)\b|أي وقت|اي وقت|أقرب|اقرب|بأسرع|باسرع/.test(t)) p.any = true;
    DAYS_RE.forEach((re, i) => { if (re.test(t)) p.days.push(i); });
    if (/weekend|نهاية الأسبوع|الويكند/.test(t)) p.days.push(5, 6);
    if (/\b(morning|am)\b|صباح|الصبح/.test(t)) p.ranges.push([7, 12]);
    if (/\bnoon\b|midday|الظهر|ظهر/.test(t)) p.ranges.push([11, 14]);
    if (/afternoon|بعد الظهر|العصر|عصر/.test(t)) p.ranges.push([12, 17]);
    if (/evening|night|مساء|المغرب|الليل|بالليل|عقب المغرب/.test(t)) p.ranges.push([16, 22]);
    const hm = /(?:after|from|بعد|من)\s*(?:الساعة\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م|صباحا|مساء)?/.exec(t); if (hm) { let h = +hm[1]; if (/pm|م|مساء/.test(hm[3] || '') && h < 12) h += 12; if (!hm[3] && h < 8) h += 12; p.ranges.push([h, 22]); }
    const bm = /(?:before|until|till|قبل|حتى|الى|إلى)\s*(?:الساعة\s*)?(\d{1,2})\s*(am|pm|ص|م)?/.exec(t); if (bm) { let h = +bm[1]; if (/pm|م/.test(bm[2] || '') && h < 12) h += 12; if (!bm[2] && h < 8) h += 12; p.ranges.push([7, h]); }
    const at = !hm && !bm && /(?:^|\s|الساعة\s*)(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)\b/.exec(t); if (at) { let h = +at[1]; if (/pm|م/.test(at[3]) && h < 12) h += 12; p.ranges.push([h - 1, h + 2]); }
    const now = new Date(), day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (/\btoday\b|اليوم/.test(t)) p.dates.push(day(now));
    if (/tomorrow|بكرة|بكره|غدا|غداً|باچر|باكر/.test(t)) { const d = new Date(now); d.setDate(d.getDate() + 1); p.dates.push(day(d)); }
    if (/next week|الأسبوع (القادم|الجاي|المقبل)|الاسبوع (القادم|الجاي|المقبل)/.test(t)) { const d = new Date(now); d.setDate(d.getDate() + (7 - d.getDay())); for (let i = 0; i < 7; i++) { const x = new Date(d); x.setDate(d.getDate() + i); p.dates.push(day(x)); } }
    const dm = /\b(\d{1,2})[\/.-](\d{1,2})\b/.exec(t); if (dm) p.dates.push(`${now.getFullYear()}-${pad(+dm[2])}-${pad(+dm[1])}`);
    const dn = /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/.exec(t); if (dn) p.dates.push(`${now.getFullYear()}-${pad(MONTHS.indexOf(dn[2]) + 1)}-${pad(+dn[1])}`);
    return p.days.length || p.ranges.length || p.dates.length || p.any ? p : null;
  }
  const matches = (iso, p) => { const d = new Date(iso), h = d.getHours() + d.getMinutes() / 60; if (p.dates.length && !p.dates.includes(iso.slice(0, 10))) return false; if (p.days.length && !p.dates.length && !p.days.includes(d.getDay())) return false; if (p.ranges.length && !p.ranges.some(([a, b]) => h >= a && h < b)) return false; return true; };
  /* Synchronous read for the assistant's chips. opts.service picks the slot length; opts.prefer (the client's free text) filters to their days/times — result.matched says whether anything fitted; otherwise the nearest times are returned. */
  function slots(lang, opts = {}) {
    const minutes = opts.minutes || minutesFor(opts.service), c = caches[minutes];
    if (!c || Date.now() - c.at > 60e3) { refresh(30, minutes); }
    const all = c ? c.list : (api() ? (caches[cfg().slotMin || 50] || { list: [] }).list : demoSlots(30, minutes));
    const pref = opts.prefer ? parsePreference(opts.prefer) : null, filtered = pref && !pref.any ? all.filter((iso) => matches(iso, pref)) : all, matched = !!pref && (pref.any || filtered.length > 0);
    const list = filtered.length ? filtered : all, perDay = opts.perDay || 2, maxDays = opts.days || 3, byDay = {}; for (const iso of list) { const k = iso.slice(0, 10); (byDay[k] = byDay[k] || []).push(iso); }
    const out = Object.keys(byDay).sort().slice(0, maxDays).flatMap((k) => byDay[k].slice(0, perDay)).map((iso) => ({ id: iso, title: label(iso, lang), iso, minutes }));
    out.matched = matched; out.parsed = !!pref; return out;
  }
  function book(slot, data) { if (api() && !serverDemo) return { ok: true, server: true }; const s = store(); if (s.bookings.some((b) => b.slot === slot)) return { ok: false, taken: true }; s.bookings.push({ slot, name: data && data.name || '', service: data && data.service || '', phone: data && data.phone || '', minutes: minutesFor(data && data.service), at: new Date().toISOString(), status: 'tentative' }); save(s); for (const k in caches) delete caches[k]; return { ok: true, demo: true }; }
  function bookings() { return store().bookings.sort((a, b) => a.slot.localeCompare(b.slot)); }
  function clearDemo() { localStorage.removeItem(KEY); for (const k in caches) delete caches[k]; }
  g.TawasolScheduler = { slots, book, bookings, label, refresh, clearDemo, minutesFor, parsePreference, isDemo: () => !api() || serverDemo, ready: Promise.all([refresh(30, cfg().slotMin || 50), refresh(30, cfg().followupMin || 25)]) };
})(typeof globalThis !== 'undefined' ? globalThis : window);
