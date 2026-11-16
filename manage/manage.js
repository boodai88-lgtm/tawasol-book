/* Tawasol · Manage — staff dashboard for the assistant. No build step.
   Live on tawasol.me it talks to <assistantApi>/api/assistant/admin/*; anywhere else (or with ?preview=1) it runs on sample data and changes nothing. */
(function () {
  'use strict';
  const C = window.TAWASOL_CONFIG || {}, API = String(C.assistantApi || '').replace(/\/$/, '');
  const LIVE = !!API && /(^|\.)tawasol\.me$/i.test(location.hostname) && !/[?&]preview=1/.test(location.search);
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ico = (n) => `<span class="ico" style="--i:url(https://unpkg.com/lucide-static@0.451.0/icons/${n}.svg)" aria-hidden="true"></span>`;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], D3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = (n) => String(n).padStart(2, '0');
  const kwToday = () => { const d = new Date(Date.now() + 3 * 3600e3); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const dOf = (d) => new Date(d + 'T12:00:00Z'), shift = (d, n) => new Date(dOf(d).getTime() + n * 864e5).toISOString().slice(0, 10);
  const fmt = (d, o) => dOf(d).toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC' }, o || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
  const t12 = (hm) => { const [h, m] = String(hm).split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`; };
  const slotLabel = (s) => fmt(s.slice(0, 10), { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + t12(s.slice(11, 16));
  const monthLabel = (m) => dOf(m + '-15').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const addMonth = (m, n) => { const [y, mo] = m.split('-').map(Number), d = new Date(Date.UTC(y, mo - 1 + n, 15)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
  const kwTime = (l) => String(l).replace(/^(\d{2}):(\d{2}):\d{2}/, (m, h, mi) => pad((+h + 3) % 24) + ':' + mi);
  const STATE = { open: 'Open for appointments', extra: 'Extra open day', closed: 'Closed', off: 'Not a clinic day', past: 'Past' };
  const st = { me: null, settings: null, history: [], status: null, statusBusy: false, chat: [], tab: 'ask', sel: null, month: kwToday().slice(0, 7), draft: '', busy: false, daysDraft: null, callDraft: null, err: '' };
  const dayState = (S, d) => { if (d < S.today) return 'past'; if (S.schedule.closed.some((c) => d >= c.from && d <= c.to)) return 'closed'; if (S.schedule.days.includes(dOf(d).getUTCDay())) return 'open'; return S.schedule.extraOpen.includes(d) ? 'extra' : 'off'; };

  /* ---------- backend ---------- */
  const tok = () => sessionStorage.getItem('tw_manage') || '';
  async function call(act, body) {
    if (!LIVE) return mock(act, body);
    const r = await fetch(API + '/api/assistant/admin/' + act, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ accept: 'application/json' }, tok() ? { authorization: 'Bearer ' + tok() } : {}, body === undefined ? {} : { 'content-type': 'application/json' }), body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && act !== 'login') { sessionStorage.removeItem('tw_manage'); st.me = null; st.err = 'Please sign in again.'; render(); throw new Error('Please sign in again.'); }
    if (!r.ok) throw new Error(j.error || 'Something went wrong (' + r.status + ').');
    return j;
  }

  /* ---------- preview backend (sample data, in memory) ---------- */
  const db = { settings: null, history: [], pending: null };
  function sample() {
    const t = kwToday();
    return { today: t, schedule: { days: [0, 1, 3], start: '15:00', end: '19:30', paused: false, extraOpen: [], closed: [{ from: '2026-11-16', to: '2026-11-30', note: 'Bookings through the assistant start in December' }, { from: '2026-12-14', to: '2027-01-05', note: 'Dr. Bibi away' }].filter((c) => c.to >= t) },
      calls: { enabled: true, days: [4], start: '14:00', end: '14:30' }, forms: { default: 'https://docs.google.com/forms/d/e/sample/viewform', byMonth: {} }, notes: [],
      admins: [{ number: '96550000001', name: 'Dr. Bibi', owner: true }, { number: '96550000002', name: 'Front desk', owner: true }],
      services: [{ id: 'psychiatry', en: 'Psychiatric clinical diagnostic interview', ar: 'المقابلة الإكلينيكية التشخيصية', min: 50, baseFee: 220, fee: 220, on: true, locked: true }, { id: 'followup', en: 'Psychiatric follow-up', ar: 'متابعة نفسية', min: 20, baseFee: 120, fee: 120, on: true }, { id: 'therapy', en: 'Individual therapy', ar: 'العلاج النفسي الفردي', min: 20, baseFee: 120, fee: 120, on: true }] };
  }
  const subtract = (list, f, t) => { const out = []; for (const c of list) { if (c.to < f || c.from > t) { out.push(c); continue; } if (c.from < f) out.push(Object.assign({}, c, { to: shift(f, -1) })); if (c.to > t) out.push(Object.assign({}, c, { from: shift(t, 1) })); } return out; };
  function localApply(S0, ops) {
    const S = JSON.parse(JSON.stringify(S0)), sch = S.schedule, svc = (id) => S.services.find((x) => x.id === id);
    for (const o of ops) {
      if (o.op === 'set_days') sch.days = o.days.slice().sort();
      else if (o.op === 'set_hours') { sch.start = o.start; sch.end = o.end; }
      else if (o.op === 'close') { sch.closed = subtract(sch.closed, o.from, o.to); sch.closed.push({ from: o.from, to: o.to, note: o.note || '' }); sch.extraOpen = sch.extraOpen.filter((d) => d < o.from || d > o.to); }
      else if (o.op === 'reopen') sch.closed = subtract(sch.closed, o.from, o.to);
      else if (o.op === 'open_date') { sch.closed = subtract(sch.closed, o.date, o.date); if (!sch.days.includes(dOf(o.date).getUTCDay()) && !sch.extraOpen.includes(o.date)) sch.extraOpen.push(o.date); }
      else if (o.op === 'unopen_date') sch.extraOpen = sch.extraOpen.filter((d) => d !== o.date);
      else if (o.op === 'pause') sch.paused = !!o.on;
      else if (o.op === 'set_calls') Object.assign(S.calls, o.enabled != null ? { enabled: o.enabled } : {}, o.days ? { days: o.days } : {}, o.start ? { start: o.start, end: o.end } : {});
      else if (o.op === 'set_fee') svc(o.service).fee = +o.fee;
      else if (o.op === 'set_service') svc(o.service).on = !!o.on;
      else if (o.op === 'set_form') { if (o.month === 'default') S.forms.default = o.url; else if (o.url) S.forms.byMonth[o.month] = o.url; else delete S.forms.byMonth[o.month]; }
      else if (o.op === 'add_note') S.notes.push({ id: 'n' + Date.now(), text: o.text, by: 'Preview', at: S.today });
      else if (o.op === 'remove_note') S.notes = S.notes.filter((n) => n.id !== o.id);
      else if (o.op === 'add_admin') S.admins.push({ number: String(o.number).replace(/\D/g, ''), name: o.name || '', owner: false });
      else if (o.op === 'remove_admin') S.admins = S.admins.filter((a) => a.number !== o.number);
    }
    sch.closed.sort((a, b) => (a.from < b.from ? -1 : 1)); sch.extraOpen.sort(); return S;
  }
  const span = (f, t) => (f === t ? fmt(f) : fmt(f) + ' to ' + fmt(t));
  const describe = (o) => ({ set_days: () => 'Appointment days: ' + o.days.map((d) => DAYS[d]).join(', '), set_hours: () => `Appointment hours: ${t12(o.start)} to ${t12(o.end)}`, close: () => 'Close ' + span(o.from, o.to), reopen: () => 'Reopen ' + span(o.from, o.to), open_date: () => 'Open for appointments: ' + fmt(o.date), unopen_date: () => 'Remove the extra day: ' + fmt(o.date), pause: () => (o.on ? 'Pause online booking' : 'Resume online booking'), set_calls: () => 'Phone calls updated', set_fee: () => 'Fee updated: KD ' + o.fee, set_service: () => (o.on ? 'Service offered again' : 'Service no longer offered'), set_form: () => 'Form link updated', add_note: () => 'Taught: “' + o.text + '”', remove_note: () => 'Note forgotten', add_admin: () => 'Admin added', remove_admin: () => 'Admin removed' }[o.op] || (() => o.op))();
  const upcoming = (S, n, days) => { const out = []; for (let i = 1; i < 84 && out.length < n; i++) { const d = shift(S.today, i), s = dayState(S, d); if (days ? (s !== 'closed' && days.includes(dOf(d).getUTCDay())) : (s === 'open' || s === 'extra')) out.push(d); } return out; };
  function sampleStatus(S) {
    const days = S.schedule.paused ? [] : upcoming(S, 8), calls = S.calls.enabled === false ? [] : upcoming(S, 2, S.calls.days);
    return { checks: [{ id: 'whatsapp', label: 'WhatsApp', state: 'warn', detail: '+1 555-165-8657 — Meta test number: only the registered test phones receive messages.' }, { id: 'calendar', label: 'Clinic calendar', state: 'ok', detail: 'Connected.' },
      { id: 'offer', label: 'Appointment times on offer', state: days.length ? 'ok' : 'warn', detail: S.schedule.paused ? 'Online booking is paused — clients are asked for a preferred time.' : days.length ? 'The earliest opening is ' + fmt(days[0]) + '.' : 'No openings in the coming weeks — clients are asked for a preferred time.' },
      { id: 'payments', label: 'Payments (Tap)', state: 'warn', detail: 'Test mode — no money is collected.' }, { id: 'brain', label: 'Assistant replies (Claude)', state: 'ok', detail: 'Connected.' }, { id: 'alerts', label: 'Staff alerts', state: 'warn', detail: 'They arrive only within 24 hours of the staff phone’s last message to the assistant (no approved template yet).' }],
      offered: { appointments: days.slice(0, 6).map((d) => d + 'T' + S.schedule.start), days, calls: calls.map((d) => d + 'T' + S.calls.start), total: days.length }, events: ['07:13:26 (sample) payment received ref=TW-SAMPLE', '07:02:11 (sample) booking request from the website', '06:11:40 (sample) in …0000 step=- id= text=(hidden)'] };
  }
  async function mock(act, body) {
    await new Promise((r) => setTimeout(r, 220)); if (!db.settings) db.settings = sample(); const me = { who: 'preview', name: 'Preview', owner: true };
    if (act === 'login') return { token: 'preview', me };
    if (act === 'logout') return { ok: true };
    if (act === 'state') return { me, settings: db.settings, history: db.history.map((h) => ({ at: h.at, by: h.by, lines: h.lines, undone: !!h.undone })) };
    if (act === 'status') return sampleStatus(db.settings);
    if (act === 'apply') {
      if (body.ops.some((o) => o.op === 'undo')) { const h = db.history.find((x) => x.prev && !x.undone); if (!h) throw new Error('There is nothing to undo.'); db.settings = h.prev; h.undone = true; db.history.unshift({ at: new Date().toISOString(), by: 'Preview', lines: ['Undo the most recent change'], undone: true }); return { ok: true, lines: ['Undone'], settings: db.settings }; }
      const prev = db.settings, lines = body.ops.map(describe); db.settings = localApply(prev, body.ops); db.history.unshift({ at: new Date().toISOString(), by: 'Preview', lines, prev }); return { ok: true, lines, settings: db.settings };
    }
    if (act === 'chat') return { reply: 'This is the preview, so the management assistant is not connected. On the live dashboard it understands requests in your own words, shows you the exact change, and waits for you to confirm.' };
    if (act === 'confirm') { const p = db.pending; db.pending = null; if (!p) return { reply: 'There is no change waiting for confirmation.' }; if (!body.yes) return { reply: 'Cancelled — nothing was changed.' }; const r = await mock('apply', { ops: p }); return { reply: 'Done — it is live within a minute. To take it back, say “undo”.', done: true, settings: r.settings }; }
    throw new Error('Unknown action.');
  }
  function seedPreview() {   // one example exchange, so the preview shows how a change is proposed and confirmed
    const S = db.settings; let d = shift(S.today, 10); while (dOf(d).getUTCDay() !== 2 || dayState(S, d) !== 'off') d = shift(d, 1);
    db.pending = [{ op: 'open_date', date: d }];
    st.chat = [{ role: 'me', text: `Open ${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })} as an extra day.` }, { role: 'bot', text: 'I will open that Tuesday for appointments.', proposal: { lines: ['Open for appointments: ' + fmt(d)], problems: [] }, state: 'open' }];
  }

  /* ---------- views ---------- */
  function viewSignIn() {
    const wa = C.assistantWhatsApp ? `https://wa.me/${esc(C.assistantWhatsApp)}?text=dashboard` : '';
    return `<div class="signin"><form class="card" data-form="login" novalidate><img src="../img/logo.png" alt="Tawasol" class="logo"><h1>Manage the assistant</h1>
      ${LIVE ? `<ol class="steps"><li>On WhatsApp, send the word <b>dashboard</b> to the Tawasol assistant from your admin phone.${wa ? ` <a href="${wa}" target="_blank" rel="noopener">Open WhatsApp</a>` : ''}</li><li>It replies with a 6-digit code. Enter it here.</li></ol>
      <label class="field"><span>Sign-in code</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 digits"></label><button class="btn" type="submit">Sign in</button>
      <details class="alt"><summary>Use the owner key instead</summary><label class="field"><span>Owner key</span><input name="key" type="password" autocomplete="current-password"></label><p class="hint">Only needed when WhatsApp is not working.</p></details>`
      : `<p class="note">Preview with sample data. Nothing here changes the real assistant.</p><button class="btn" type="submit">Open the preview</button>`}
      <p class="err" role="alert">${esc(st.err)}</p></form></div>`;
  }
  const TABS = [['ask', 'Ask', 'message-circle'], ['schedule', 'Schedule', 'calendar-days'], ['setup', 'Setup', 'sliders-horizontal'], ['health', 'Health', 'activity']];
  function viewShell() {
    const body = ({ ask: viewAsk, schedule: viewSchedule, setup: viewSetup, health: viewHealth }[st.tab] || viewAsk)();
    return `<div class="shell"><header class="top"><img src="../img/logo.png" alt="Tawasol"><b>Manage</b><span class="grow"></span><span class="who">${esc(st.me.name)}</span><button class="iconbtn" data-act="signout" aria-label="Sign out" title="Sign out">${ico('log-out')}</button></header>
      <nav class="tabs" aria-label="Sections">${TABS.map(([id, l, i]) => `<button data-act="tab" data-tab="${id}" ${st.tab === id ? 'aria-current="page"' : ''}>${ico(i)}<span>${l}</span></button>`).join('')}</nav>
      <main id="main" class="tab-${st.tab}">${LIVE ? '' : '<p class="note preview">Preview with sample data — nothing here changes the real assistant.</p>'}${body}</main></div>`;
  }
  const SUGGEST = ['What will clients be offered this week?', 'Close the clinic from … to …', 'The intake form for next month is …', 'Teach the assistant: …', 'Why did a message not arrive?'];
  function viewAsk() {
    const msgs = st.chat.map((m, i) => (m.role === 'me' ? `<div class="bubble me" dir="auto">${esc(m.text)}</div>` : `<div class="bubble bot" dir="auto">${esc(m.text)}${m.proposal ? `<div class="proposal"><ul>${m.proposal.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${(m.proposal.problems || []).length ? `<p class="hint">${esc(m.proposal.problems.join(' '))}</p>` : ''}${m.state === 'open' ? `<div class="row"><button class="btn sm" data-act="confirm" data-i="${i}" data-yes="1">Confirm</button><button class="btn o sm" data-act="confirm" data-i="${i}">Cancel</button></div>` : `<p class="hint">${m.state === 'done' ? 'Confirmed.' : 'Cancelled.'}</p>`}</div>` : ''}</div>`)).join('');
    return `<section class="chat"><div class="thread" id="thread" role="log" aria-live="polite">${st.chat.length ? msgs : `<div class="empty"><h1>What would you like to change or check?</h1><p>Write it in your own words, in English or Arabic. Every change is shown to you before it happens, and can be undone.</p><div class="chips">${SUGGEST.map((s) => `<button class="chip" data-act="suggest">${esc(s)}</button>`).join('')}</div></div>`}${st.busy ? '<div class="bubble bot typing" role="status" aria-label="Thinking"><i></i><i></i><i></i></div>' : ''}</div>
      <form class="composer" data-form="chat"><textarea name="message" rows="1" placeholder="Write a message…" aria-label="Message" dir="auto" enterkeyhint="send">${esc(st.draft)}</textarea><button class="btn icon" type="submit" aria-label="Send" ${st.busy ? 'disabled' : ''}>${ico('send')}</button></form></section>`;
  }
  function viewSchedule() {
    const S = st.settings, sch = S.schedule, days = st.daysDraft || sch.days, dirty = days.join() !== sch.days.join(), cd = st.callDraft || S.calls.days;
    const m = st.month, first = dOf(m + '-01'), len = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(), cells = [];
    for (let i = 0; i < first.getUTCDay(); i++) cells.push('<span></span>');
    for (let d = 1; d <= len; d++) { const ds = m + '-' + pad(d), s = dayState(S, ds); cells.push(`<button type="button" class="${s}${ds === S.today ? ' today' : ''}${ds === st.sel ? ' sel' : ''}" data-act="pick" data-d="${ds}" ${s === 'past' ? 'disabled' : ''} aria-label="${fmt(ds)} — ${STATE[s]}" aria-pressed="${ds === st.sel}">${d}</button>`); }
    const sel = st.sel, ss = sel ? dayState(S, sel) : null, note = sel ? (sch.closed.find((c) => sel >= c.from && sel <= c.to) || {}).note : '';
    const btn = { closed: ['open_date', 'Open this day', ''], open: ['close', 'Close this day', ' o'], extra: ['unopen_date', 'Remove this extra day', ' o'], off: ['open_date', 'Open as an extra day', ''] }[ss];
    return `<div class="head"><h1>Schedule</h1></div>
    ${sch.paused ? '<p class="note" style="margin-bottom:12px"><b>Online booking is paused.</b> Clients are asked for a preferred time instead of being shown times.</p>' : ''}
    <div class="grid2"><div class="card"><div class="calhead"><button class="iconbtn" data-act="month" data-n="-1" aria-label="Previous month" ${m <= S.today.slice(0, 7) ? 'disabled style="opacity:.3"' : ''}>${ico('chevron-left')}</button><b>${monthLabel(m)}</b><button class="iconbtn" data-act="month" data-n="1" aria-label="Next month">${ico('chevron-right')}</button></div>
      <div class="cal">${D3.map((n) => `<span class="dow">${n}</span>`).join('')}${cells.join('')}</div>
      <p class="legend"><span><i class="l-open"></i>Open</span><span><i class="l-extra"></i>Extra day</span><span><i class="l-closed"></i>Closed</span></p>
      ${sel && btn ? `<div class="selbox"><div><b>${fmt(sel)}</b><span>${STATE[ss]}${note ? ' — ' + esc(note) : ''}</span></div><button class="btn sm${btn[2]}" data-act="dayop" data-op="${btn[0]}">${btn[1]}</button></div>` : '<p class="hint" style="margin-top:12px">Tap a day to open or close it.</p>'}</div>
    <div class="card"><h2>Closed periods</h2><p class="hint">No appointments and no phone calls are offered on these dates.</p>
      ${sch.closed.length ? `<ul class="plain">${sch.closed.map((c, i) => `<li><div><b>${c.from === c.to ? fmt(c.from) : fmt(c.from) + ' – ' + fmt(c.to)}</b>${c.note ? `<span>${esc(c.note)}</span>` : ''}</div><button class="btn o sm" data-act="reopen" data-i="${i}">Reopen</button></li>`).join('')}</ul>` : '<p class="hint" style="margin-top:8px">None.</p>'}
      <form data-form="close" class="formrow"><label class="field"><span>Close from</span><input type="date" name="from" min="${S.today}" required></label><label class="field"><span>To</span><input type="date" name="to" min="${S.today}" required></label><label class="field" style="grid-column:1/-1"><span>Reason (optional)</span><input name="note" maxlength="120"></label><button class="btn o sm">Close this period</button></form></div></div>
    <div class="grid2"><div class="card"><h2>Weekly appointment days</h2><div class="daychips">${D3.map((n, i) => `<button type="button" class="daychip" data-act="day" data-d="${i}" aria-pressed="${days.includes(i)}" aria-label="${DAYS[i]}">${n}</button>`).join('')}</div>
      ${dirty ? '<div class="row"><button class="btn sm" data-act="savedays">Save days</button><button class="btn o sm" data-act="resetdays">Cancel</button></div>' : ''}
      <form data-form="hours" class="formrow"><label class="field"><span>From</span><input type="time" name="start" value="${sch.start}" step="1800" required></label><label class="field"><span>To</span><input type="time" name="end" value="${sch.end}" step="1800" required></label><button class="btn o sm">Save hours</button></form>
      <label class="sw"><input type="checkbox" data-act="pause" ${sch.paused ? 'checked' : ''}><span>Pause online booking<small>Clients are asked for a preferred time instead.</small></span></label></div>
    <div class="card"><h2>Phone calls with the doctor</h2><p class="hint">Free 5-minute calls, booked by the client through the assistant.</p>
      <label class="sw"><input type="checkbox" data-act="callson" ${S.calls.enabled !== false ? 'checked' : ''}><span>Offer phone calls</span></label>
      <div class="daychips">${D3.map((n, i) => `<button type="button" class="daychip" data-act="callday" data-d="${i}" aria-pressed="${cd.includes(i)}" aria-label="${DAYS[i]}">${n}</button>`).join('')}</div>
      <form data-form="calls" class="formrow"><label class="field"><span>From</span><input type="time" name="start" value="${S.calls.start}" step="300" required></label><label class="field"><span>To</span><input type="time" name="end" value="${S.calls.end}" step="300" required></label><button class="btn o sm">Save calls</button></form></div></div>`;
  }
  function viewSetup() {
    const S = st.settings, months = [0, 1, 2].map((n) => addMonth(S.today.slice(0, 7), n));
    return `<div class="head"><h1>Setup</h1></div>
    <div class="card"><h2>Services and fees</h2><form data-form="fees"><ul class="plain svc">${S.services.map((s) => `<li><div><b>${esc(s.en)}</b><span class="ar" dir="rtl" lang="ar">${esc(s.ar)}</span><span>${s.min} minutes${s.on ? '' : ' · not offered'}</span></div><label class="field fee"><span>Fee (KD)</span><input name="fee:${s.id}" inputmode="decimal" value="${s.fee}" aria-label="Fee for ${esc(s.en)} in KD"></label>${s.locked ? '<span class="hint lock">Always offered</span>' : `<label class="sw"><input type="checkbox" data-act="svc" data-id="${s.id}" ${s.on ? 'checked' : ''}><span>Offered</span></label>`}</li>`).join('')}</ul>
      <div class="row"><button class="btn o sm">Save fees</button><span class="hint">The payment link charges exactly these amounts.</span></div></form></div>
    <div class="card"><h2>Intake form links</h2><p class="hint">Sent to the client once the appointment is paid. A month without its own link uses the standard form.</p>
      <form data-form="forms" class="stack"><label class="field"><span>Standard form</span><input name="default" type="url" value="${esc(S.forms.default)}"></label>${months.map((m) => `<label class="field"><span>${monthLabel(m)} appointments</span><input name="m:${m}" type="url" value="${esc(S.forms.byMonth[m] || '')}" placeholder="Uses the standard form"></label>`).join('')}<div class="row" style="margin-top:0"><button class="btn o sm">Save links</button></div></form></div>
    <div class="card"><h2>What the assistant has been taught</h2><p class="hint">Short facts or instructions, used on the website and on WhatsApp. Fees, hours and dates are changed in their own sections, not here.</p>
      ${S.notes.length ? `<ul class="plain">${S.notes.map((n) => `<li><div><b dir="auto">${esc(n.text)}</b><span>${esc(n.by || '')}${n.at ? ' · ' + fmt(n.at, { day: 'numeric', month: 'short' }) : ''}</span></div><button class="btn o sm" data-act="forget" data-id="${esc(n.id)}">Forget</button></li>`).join('')}</ul>` : '<p class="hint" style="margin-top:8px">Nothing yet.</p>'}
      <form data-form="note" class="stack"><label class="field"><span>Teach something new</span><textarea name="text" rows="2" maxlength="500" dir="auto" placeholder="Write it the way the assistant should know it"></textarea></label><div class="row" style="margin-top:0"><button class="btn o sm">Teach</button></div></form></div>
    <div class="card"><h2>Who can manage</h2><ul class="plain">${S.admins.map((a) => `<li><div><b>${esc(a.name || 'Admin')}</b><span>+${esc(a.number)}${a.owner ? ' · fixed' : ''}</span></div>${!a.owner && st.me.owner ? `<button class="btn o sm" data-act="rmadmin" data-n="${esc(a.number)}">Remove</button>` : ''}</li>`).join('')}</ul>
      ${st.me.owner ? '<form data-form="admin" class="formrow"><label class="field"><span>WhatsApp number</span><input name="number" inputmode="tel" placeholder="9655xxxxxxx"></label><label class="field"><span>Name</span><input name="name" maxlength="40"></label><button class="btn o sm">Add admin</button></form>' : '<p class="hint" style="margin-top:8px">Only Dr. Bibi or the front-desk phone can add admins.</p>'}</div>`;
  }
  function viewHealth() {
    const s = st.status, WORD = { ok: 'Working', warn: 'Attention', bad: 'Not working' }, canUndo = st.history.some((h) => !h.undone);
    if (!s) { loadStatus(); return '<div class="head"><h1>Health</h1></div><p class="hint">Checking…</p>'; }
    return `<div class="head"><h1>Health</h1><button class="btn o sm" data-act="recheck">${ico('refresh-cw')}Check again</button></div>
    <div class="card"><ul class="checks">${s.checks.map((c) => `<li><span class="dot ${c.state}"></span><div><b>${esc(c.label)}</b> <span class="state ${c.state}">${WORD[c.state] || ''}</span><p>${esc(c.detail)}</p></div></li>`).join('')}</ul></div>
    <div class="grid2"><div class="card"><h2>What clients are offered now</h2><p class="hint">First appointment times</p>${(s.offered.appointments || []).length ? `<ul class="times">${s.offered.appointments.map((x) => `<li>${slotLabel(x)}</li>`).join('')}</ul>` : '<p class="hint"><b>None</b> — clients are asked for a preferred time.</p>'}
      <p class="hint" style="margin-top:12px">Phone calls</p>${(s.offered.calls || []).length ? `<ul class="times">${s.offered.calls.map((x) => `<li>${slotLabel(x)}</li>`).join('')}</ul>` : '<p class="hint"><b>None</b> in the coming weeks.</p>'}</div>
    <div class="card"><h2>Recent changes</h2>${st.history.length ? `<ul class="plain">${st.history.slice(0, 8).map((h) => `<li><div><b>${esc(h.lines.join(' · '))}</b><span>${esc(h.by)} · ${new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuwait' })}${h.undone ? ' · undone' : ''}</span></div></li>`).join('')}</ul>${canUndo ? `<div class="row"><button class="btn o sm" data-act="undo">${ico('undo-2')}Undo the last change</button></div>` : ''}` : '<p class="hint">No changes yet.</p>'}</div></div>
    <div class="card"><h2>Recent events</h2><p class="hint">Newest first, Kuwait time. Client words and numbers are hidden.</p>${(s.events || []).length ? `<ol class="events">${s.events.map((e) => `<li>${esc(kwTime(e))}</li>`).join('')}</ol>` : '<p class="hint" style="margin-top:8px">Nothing recorded yet.</p>'}</div>`;
  }

  /* ---------- rendering ---------- */
  function render() {
    const keep = document.activeElement && document.activeElement.name === 'message';
    $('#app').innerHTML = st.me && st.settings ? viewShell() : viewSignIn();
    const th = $('#thread'); if (th) th.scrollTop = th.scrollHeight;
    const ta = $('.composer textarea'); if (ta) { grow(ta); if (keep) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
  }
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(132, ta.scrollHeight + 2) + 'px'; };
  function toast(msg, o) { const t = $('#toast'); o = o || {}; t.innerHTML = `<span>${esc(msg)}</span>${o.undo ? '<button data-act="undo">Undo</button>' : ''}`; t.className = 'show' + (o.bad ? ' bad' : ''); clearTimeout(toast.h); toast.h = setTimeout(() => { t.className = ''; }, o.bad ? 6000 : 4500); }
  async function loadState() { const s = await call('state'); st.me = s.me; st.settings = s.settings; st.history = s.history || []; }
  function loadStatus() { if (st.statusBusy) return; st.statusBusy = true; call('status').then((s) => { st.status = s; }).catch((e) => { st.status = { checks: [{ id: 'dash', label: 'Dashboard', state: 'bad', detail: e.message }], offered: {}, events: [] }; }).then(() => { st.statusBusy = false; if (st.me && st.tab === 'health') render(); }); }
  async function change(ops, msg) {
    try { const r = await call('apply', { ops }); st.settings = r.settings; st.daysDraft = null; st.callDraft = null; st.status = null; toast((msg || (r.lines || []).join(' · ') || 'Saved') + ' — live within a minute', { undo: !ops.some((o) => o.op === 'undo') }); try { st.history = (await call('state')).history || []; } catch (_) {} }
    catch (e) { toast(e.message, { bad: true }); }
    render();
  }

  /* ---------- actions ---------- */
  const actions = {
    tab(el) { st.tab = el.dataset.tab; if (st.tab === 'health') st.status = null; render(); $('#main').scrollTop = 0; },
    async signout() { try { await call('logout', {}); } catch (_) {} sessionStorage.removeItem('tw_manage'); st.me = null; st.settings = null; st.chat = []; st.err = ''; render(); },
    suggest(el) { st.draft = el.textContent.replace(/…$/, ''); render(); const ta = $('.composer textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); },
    async confirm(el) { const m = st.chat[+el.dataset.i], yes = el.dataset.yes === '1'; if (!m || m.state !== 'open') return; m.state = yes ? 'done' : 'cancelled'; st.busy = true; render();
      try { const r = await call('confirm', { yes }); if (r.settings) { st.settings = r.settings; st.status = null; try { st.history = (await call('state')).history || []; } catch (_) {} } st.chat.push({ role: 'bot', text: r.reply }); } catch (e) { st.chat.push({ role: 'bot', text: e.message }); }
      st.busy = false; render(); },
    month(el) { st.month = addMonth(st.month, +el.dataset.n); st.sel = null; render(); },
    pick(el) { st.sel = st.sel === el.dataset.d ? null : el.dataset.d; render(); },
    dayop(el) { const d = st.sel, op = el.dataset.op; change([op === 'close' ? { op, from: d, to: d } : { op, date: d }]); },
    reopen(el) { const c = st.settings.schedule.closed[+el.dataset.i]; if (c) change([{ op: 'reopen', from: c.from, to: c.to }]); },
    day(el) { const d = +el.dataset.d, cur = (st.daysDraft || st.settings.schedule.days).slice(); st.daysDraft = cur.includes(d) ? cur.filter((x) => x !== d) : cur.concat(d).sort(); render(); },
    savedays() { if (!st.daysDraft.length) return toast('Choose at least one day.', { bad: true }); change([{ op: 'set_days', days: st.daysDraft }]); },
    resetdays() { st.daysDraft = null; render(); },
    pause(el) { change([{ op: 'pause', on: !st.settings.schedule.paused }]); },
    callson() { change([{ op: 'set_calls', enabled: st.settings.calls.enabled === false }]); },
    callday(el) { const d = +el.dataset.d, cur = (st.callDraft || st.settings.calls.days).slice(); st.callDraft = cur.includes(d) ? cur.filter((x) => x !== d) : cur.concat(d).sort(); render(); },
    svc(el) { const s = st.settings.services.find((x) => x.id === el.dataset.id); change([{ op: 'set_service', service: s.id, on: !s.on }]); },
    forget(el) { change([{ op: 'remove_note', id: el.dataset.id }]); },
    rmadmin(el) { change([{ op: 'remove_admin', number: el.dataset.n }]); },
    undo() { change([{ op: 'undo' }], 'Undone'); },
    recheck() { st.status = null; render(); },
  };
  const forms = {
    async login(f) {
      const code = f.code ? f.code.value.replace(/\D/g, '') : '', key = f.key ? f.key.value.trim() : ''; st.err = '';
      if (LIVE && !key && code.length !== 6) { st.err = 'Enter the 6-digit code from WhatsApp.'; return render(); }
      try { const r = await call('login', key ? { key } : { code }); sessionStorage.setItem('tw_manage', r.token); await loadState(); if (!LIVE) seedPreview(); } catch (e) { st.me = null; st.err = e.message; }
      render();
    },
    async chat(f) {
      const text = f.message.value.trim(); if (!text || st.busy) return; st.chat.push({ role: 'me', text }); st.draft = ''; st.busy = true; render();
      try { const r = await call('chat', { message: text }); st.chat.forEach((m) => { if (m.state === 'open') m.state = 'cancelled'; }); st.chat.push({ role: 'bot', text: r.reply, proposal: r.proposal || null, state: r.proposal ? 'open' : null }); } catch (e) { st.chat.push({ role: 'bot', text: e.message }); }
      st.busy = false; render(); const ta = $('.composer textarea'); if (ta) ta.focus();
    },
    hours(f) { change([{ op: 'set_hours', start: f.start.value, end: f.end.value }]); },
    close(f) { if (!f.from.value || !f.to.value) return toast('Choose both dates.', { bad: true }); change([{ op: 'close', from: f.from.value, to: f.to.value, note: f.note.value.trim() }]); },
    calls(f) { const days = st.callDraft || st.settings.calls.days; if (!days.length) return toast('Choose at least one day.', { bad: true }); change([{ op: 'set_calls', days, start: f.start.value, end: f.end.value }]); },
    fees(f) { const ops = []; for (const s of st.settings.services) { const v = parseFloat(String(f['fee:' + s.id].value).replace(',', '.')); if (!(v > 0)) return toast('Enter a fee for ' + s.en + '.', { bad: true }); if (v !== s.fee) ops.push({ op: 'set_fee', service: s.id, fee: v }); } if (!ops.length) return toast('No fee was changed.'); change(ops); },
    forms(f) { const S = st.settings, ops = [], d = f.default.value.trim(); if (d !== S.forms.default) ops.push({ op: 'set_form', month: 'default', url: d }); for (const el of f.querySelectorAll('input[name^="m:"]')) { const m = el.name.slice(2), v = el.value.trim(); if (v !== (S.forms.byMonth[m] || '')) ops.push({ op: 'set_form', month: m, url: v }); } if (!ops.length) return toast('No link was changed.'); change(ops, 'Form links saved'); },
    note(f) { const text = f.text.value.trim(); if (text.length < 3) return toast('Write the note first.', { bad: true }); change([{ op: 'add_note', text }], 'Taught'); },
    admin(f) { const number = f.number.value.replace(/\D/g, ''); if (number.length < 8) return toast('Enter the WhatsApp number with its country code.', { bad: true }); change([{ op: 'add_admin', number, name: f.name.value.trim() }], 'Admin added'); },
  };
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const fn = actions[el.dataset.act]; if (fn) { e.preventDefault(); fn(el); } });
  document.addEventListener('submit', (e) => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); forms[f.dataset.form](f); });
  document.addEventListener('input', (e) => { if (e.target.name === 'message') { st.draft = e.target.value; grow(e.target); } });
  document.addEventListener('keydown', (e) => { if (e.target.name === 'message' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); } });

  /* ---------- start ---------- */
  (async function boot() {
    const code = (location.hash.match(/^#(\d{6})$/) || [])[1], q = new URLSearchParams(location.search); if (code) history.replaceState(null, '', location.pathname + location.search);
    if (TABS.some((t) => t[0] === q.get('tab'))) st.tab = q.get('tab');   // ?tab=schedule opens on that section
    render();
    try {
      if (LIVE && code) { const r = await call('login', { code }); sessionStorage.setItem('tw_manage', r.token); }
      if (!LIVE && q.get('auto') === '1' && !tok()) sessionStorage.setItem('tw_manage', (await call('login', {})).token);   // preview only: skip the sign-in card
      if (tok()) { await loadState(); if (!LIVE) seedPreview(); }
    } catch (e) { if (!st.err) st.err = e.message; st.me = null; }
    render();
  })();
})();
