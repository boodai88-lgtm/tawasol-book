/**
 * Tawasol calendar bridge · Google Apps Script
 * Runs INSIDE the clinic's Google account (tawasolclinic.kw@gmail.com) — no Google Cloud project, no service-account key.
 * The Tawasol worker calls this web app with a shared secret to read busy times and to create HOLD events.
 *
 * SETUP (once, ~5 minutes, signed in as the clinic Gmail):
 *  1. script.google.com → New project → delete the sample code → paste this whole file.
 *  2. Change SECRET below to a long random string (letters + numbers, 30+ characters). Keep it private.
 *  3. (Optional) CALENDAR_ID: leave 'primary' to use the account's main calendar, or paste the ID of a
 *     calendar named "Tawasol — Appointments" (Calendar settings → Integrate calendar → Calendar ID).
 *  4. Click the project name (top-left) → rename to "Tawasol calendar bridge". Save (⌘S / Ctrl+S).
 *  5. Deploy → New deployment → ⚙ type: Web app → Description "v1" → Execute as: Me → Who has access: Anyone → Deploy.
 *     Authorize when asked (Advanced → Go to Tawasol calendar bridge (unsafe) → Allow). It is your own script.
 *  6. Copy the Web app URL (ends in /exec). Give the worker: GCAL_BRIDGE_URL = that URL, GCAL_BRIDGE_SECRET = your SECRET.
 *  7. Test in the browser: <URL>?secret=YOUR_SECRET&action=ping → should show {"ok":true,...}.
 *     <URL>?secret=YOUR_SECRET&action=inbox_url → creates (first time) and shows the link of the "Tawasol — Inbox" spreadsheet. Share it with Juana.
 *     <URL>?secret=YOUR_SECRET&action=create_forms → creates the Intake + Consent Google Forms (draft wording) in this account; responses go to tabs in the Inbox sheet. The website picks the links up by itself.
 *     <URL>?secret=YOUR_SECRET&action=set_forms&intake=<link>&consent=<link> → use the clinic's EXISTING forms instead (Google Forms, PDFs on Drive, anything with a link).
 *  8. Run installTriggers() once from the editor (▶ next to the function name, allow permissions) — payment reminders, expiries and follow-up prompts then run every 15 minutes.
 *  Tabs created automatically in the Inbox spreadsheet: Payments (one row per payment link), Patients (WhatsApp · Name · Last psychiatric visit · Next follow-up due · Refill valid until · Diagnosis · Medications · Notes · Passcode).
 *  After editing this file later: Deploy → Manage deployments → ✎ → Version: New version → Deploy (same URL).
 */
const SECRET = 'PASTE-A-LONG-RANDOM-SECRET-HERE';
const CALENDAR_ID = 'primary';
const TZ = 'Asia/Kuwait';
/* Inbox: every booking, question, clinical update and urgent request from the assistant is appended to this spreadsheet (created in the clinic Drive the first time;
   or paste the ID of an existing sheet). Tabs: Inbox (one row per request — Juana works from the Status column), Transcripts (the chat, for context). */
const INBOX_SHEET_ID = '';
const INBOX_NAME = 'Tawasol — Inbox';
/* The assistant worker (for payment reminders / expiries / follow-up prompts sent from the time trigger). Same SECRET as GCAL_BRIDGE_SECRET on the worker. */
const WORKER_URL = 'https://aged-mud-dbb7.boodai88.workers.dev';
const PAY_HOURS = 24, REMIND_HOURS_BEFORE = 2, REFILL_MONTHS = 6, FOLLOWUP_NOTICE_DAYS = 7, RESCHEDULE_HOURS = 48;
const PAY_HEAD = ['Ref', 'Charge ID', 'Status', 'Amount KD', 'Name', 'WhatsApp', 'Service', 'Minutes', 'Slot', 'Slot label', 'Event ID', 'Created', 'Expires', 'Reminded', 'Paid at', 'Pay URL', 'Lang', 'Pickup'];
const PAT_HEAD = ['WhatsApp', 'Name', 'Last psychiatric visit', 'Next follow-up due', 'Refill valid until', 'Diagnosis', 'Medications', 'Notes', 'Passcode', 'Follow-up reminded'];
function tab_(ss, name, head) { let sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); } return sh; }
const last8_ = (p) => String(p || '').replace(/\D/g, '').slice(-8);
function rows_(sh) { const v = sh.getDataRange().getValues(); return v.slice(1).map(function (row, i) { return { i: i + 2, v: row }; }); }
function notify_(payload) { if (!WORKER_URL) return; try { UrlFetchApp.fetch(WORKER_URL + '/api/assistant/notify', { method: 'post', contentType: 'application/json', headers: { 'x-bridge-secret': SECRET }, payload: JSON.stringify(payload), muteHttpExceptions: true }); } catch (e) { console.error('notify failed', e); } }
function fmtKw_(d) { return Utilities.formatDate(d, TZ, 'EEEE d MMMM, h:mm a'); }
function addMonths_(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function iso_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
/* Time trigger: run installTriggers() ONCE from the editor (▶). tick() then runs every 15 minutes: payment reminders 2 h before expiry, expiry → release the hold, follow-up prompts. */
function installTriggers() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t); }); ScriptApp.newTrigger('tick').timeBased().everyMinutes(15).create(); }
function tick() { return tick_(); }
function tick_() {
  const ss = inbox_(), pay = tab_(ss, 'Payments', PAY_HEAD), now = new Date(), done = { reminded: 0, expired: 0, followups: 0 };
  rows_(pay).forEach(function (r) { const v = r.v; if (v[2] !== 'pending') return; const exp = new Date(v[12]); if (isNaN(exp)) return;
    if (now >= exp) { pay.getRange(r.i, 3).setValue('expired'); try { const ev = v[10] ? cal_().getEventById(String(v[10])) : null; if (ev && /^HOLD/i.test(ev.getTitle())) ev.deleteEvent(); } catch (e) {} notify_({ type: 'pay_expired', phone: v[5], lang: v[16], slotLabel: v[9], service: v[6], ref: v[0] }); done.expired++; }
    else if (!v[13] && now >= new Date(exp.getTime() - REMIND_HOURS_BEFORE * 3600e3)) { pay.getRange(r.i, 14).setValue(Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm')); notify_({ type: 'pay_reminder', phone: v[5], lang: v[16], slotLabel: v[9], service: v[6], url: v[15], deadline: Utilities.formatDate(exp, TZ, 'h:mm a'), ref: v[0] }); done.reminded++; } });
  const pat = tab_(ss, 'Patients', PAT_HEAD), soon = new Date(now.getTime() + FOLLOWUP_NOTICE_DAYS * 864e5);
  rows_(pat).forEach(function (r) { const v = r.v, due = v[3] ? new Date(v[3]) : null; if (!due || isNaN(due) || v[9]) return; if (due <= soon) { pat.getRange(r.i, 10).setValue(iso_(now)); notify_({ type: 'followup_due', phone: v[0], name: String(v[1] || '').split(' ')[0], lang: /[\u0600-\u06FF]/.test(String(v[1])) ? 'ar' : 'en' }); done.followups++; } });
  return Object.assign({ ok: true, at: now.toISOString() }, done);
}
/* Events whose title starts with one of these words are BOOKABLE WINDOWS, not appointments: the assistant offers times only inside them.
   Example: an event "OPEN" from 16:00 to 20:00 repeating weekly on Sun/Tue/Thu. Delete all OPEN events to go back to the default grid. */
const OPEN_RE = /^\s*(open|available|bookable|متاح|مفتوح)\b/i;

function cal_() { const c = CALENDAR_ID === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CALENDAR_ID); if (!c) throw new Error('Calendar not found: ' + CALENDAR_ID); return c; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
const INBOX_HEAD = ['Received (Kuwait)', 'Ref', 'Type', 'Status', 'Name', 'WhatsApp', 'For (who)', 'Age', 'First / returning', 'Service', 'Mode', 'Chosen time', 'Preferred days/times', 'Message / question', 'Calendar hold', 'Language', 'Channel', 'Team note'];
function inbox_() {
  const props = PropertiesService.getScriptProperties(); let id = INBOX_SHEET_ID || props.getProperty('INBOX_SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(INBOX_NAME); props.setProperty('INBOX_SHEET_ID', ss.getId()); const sh = ss.getActiveSheet(); sh.setName('Inbox'); sh.appendRow(INBOX_HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, INBOX_HEAD.length).setFontWeight('bold'); sh.getRange('D2:D1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['new', 'contacted', 'booked', 'closed'], true).build()); const tr = ss.insertSheet('Transcripts'); tr.appendRow(['Ref', 'Received (Kuwait)', 'Transcript']); tr.setFrozenRows(1); }
  return ss;
}
/* Forms: two Google Forms created inside the clinic account (DRAFT wording — Dr. Bibi edits them in Google Forms; the links stay the same). Responses land as tabs in the Inbox spreadsheet. */
function forms_(force) {
  const props = PropertiesService.getScriptProperties(); const have = props.getProperty('FORMS_JSON');
  if (have && !force) return JSON.parse(have);
  const ss = inbox_();
  const f1 = FormApp.create('Tawasol — Intake form / استمارة ما قبل الزيارة');
  f1.setDescription('Please fill this in before your first visit (about 5 minutes). Everything you write is confidential and goes only to the clinic team.\nيرجى تعبئة هذه الاستمارة قبل زيارتك الأولى (نحو ٥ دقائق). كل ما تكتبه سري ويصل إلى فريق العيادة فقط.\n\n[DRAFT — to be reviewed by Dr. Bibi before use]');
  f1.setCollectEmail(false); f1.setProgressBar(true); f1.setConfirmationMessage('Thank you — the team has received your form. / شكراً لك، وصلت الاستمارة إلى الفريق.');
  f1.addTextItem().setTitle('Full name of the person attending / الاسم الكامل لصاحب الموعد').setRequired(true);
  f1.addDateItem().setTitle('Date of birth / تاريخ الميلاد').setRequired(true);
  f1.addTextItem().setTitle('WhatsApp number / رقم الواتساب').setRequired(true);
  f1.addMultipleChoiceItem().setTitle('Who is filling in this form? / من يعبّئ هذه الاستمارة؟').setChoiceValues(['Myself / أنا', 'Parent or guardian / أحد الوالدين أو الوصي', 'Other / شخص آخر']).setRequired(true);
  f1.addParagraphTextItem().setTitle('What brings you to the clinic? In your own words. / ما الذي دفعك لزيارة العيادة؟ بكلماتك').setRequired(true);
  f1.addMultipleChoiceItem().setTitle('Have you had psychiatric or psychological care before? / هل سبق أن تلقيت رعاية نفسية؟').setChoiceValues(['Yes / نعم', 'No / لا']).setRequired(true);
  f1.addParagraphTextItem().setTitle('If yes: where, when, and any diagnosis you were given / إن كانت الإجابة نعم: أين ومتى، وما التشخيص إن وُجد');
  f1.addParagraphTextItem().setTitle('Current medications (name and dose) / الأدوية الحالية (الاسم والجرعة)');
  f1.addParagraphTextItem().setTitle('Medical conditions or allergies / الأمراض المزمنة أو الحساسية');
  f1.addMultipleChoiceItem().setTitle('Preferred language for the session / اللغة المفضلة للجلسة').setChoiceValues(['Arabic / العربية', 'English / الإنجليزية', 'Either / لا فرق']);
  f1.addParagraphTextItem().setTitle('Anything else you would like the doctor to know before the session / أي شيء آخر تودّ أن يعرفه الطبيب قبل الجلسة');
  const f2 = FormApp.create('Tawasol — Consent form / نموذج الموافقة');
  f2.setDescription('Please read and confirm before the first session. For clients under 18, a parent or legal guardian completes this form.\nيرجى القراءة والتأكيد قبل الجلسة الأولى. لمن هم دون ١٨ عاماً يعبّئ النموذج أحد الوالدين أو الوصي القانوني.\n\n[DRAFT — to be reviewed by Dr. Bibi before use]');
  f2.setCollectEmail(false); f2.setConfirmationMessage('Thank you — your consent has been recorded. / شكراً لك، تم تسجيل موافقتك.');
  f2.addTextItem().setTitle('Full name of the person attending / الاسم الكامل لصاحب الموعد').setRequired(true);
  f2.addTextItem().setTitle('If under 18: full name of the parent or guardian / لمن هم دون ١٨: الاسم الكامل للوالد أو الوصي');
  const st = ['I understand that Tawasol provides psychiatric consultations and follow-up sessions, and that the first visit is an assessment. / أفهم أن تواصل تقدم استشارات نفسية وجلسات متابعة، وأن الزيارة الأولى هي تقييم.', 'I understand the fees and the cancellation policy: changes with less than 24 hours’ notice may forfeit the session fee. / أفهم الرسوم وسياسة الإلغاء: قد يؤدي التغيير قبل أقل من ٢٤ ساعة إلى خسارة رسوم الجلسة.', 'I understand that what I share is confidential, except where there is a serious risk to safety or a legal duty to disclose. / أفهم أن ما أشاركه سري، إلا عند وجود خطر جدي على السلامة أو واجب قانوني بالإفصاح.', 'I agree that the clinic may contact me on WhatsApp about appointments and clinical follow-up. / أوافق على أن تتواصل معي العيادة عبر واتساب بشأن المواعيد والمتابعة.'];
  f2.addCheckboxItem().setTitle('Please confirm each statement / يرجى تأكيد كل بند').setChoiceValues(st).setValidation(FormApp.createCheckboxValidation().requireSelectExactly(st.length).setHelpText('Please tick all four / يرجى تأكيد البنود الأربعة').build()).setRequired(true);
  f2.addMultipleChoiceItem().setTitle('For clients under 18 / للعملاء دون ١٨ عاماً').setChoiceValues(['Not applicable / لا ينطبق', 'I am the parent or legal guardian and I consent to the assessment and care. / أنا الوالد أو الوصي القانوني وأوافق على التقييم والرعاية.']).setRequired(true);
  f2.addTextItem().setTitle('Type your full name as your electronic signature / اكتب اسمك الكامل كتوقيع إلكتروني').setRequired(true);
  f2.addDateItem().setTitle('Date / التاريخ').setRequired(true);
  [f1, f2].forEach(function (f) { f.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId()); });
  try { ss.getSheets().forEach(function (sh) { const u = sh.getFormUrl() || ''; if (u && u.indexOf(f1.getId()) >= 0) sh.setName('Intake responses'); else if (u && u.indexOf(f2.getId()) >= 0) sh.setName('Consent responses'); }); } catch (e) {}
  const short = function (f) { try { return f.shortenFormUrl(f.getPublishedUrl()); } catch (e) { return f.getPublishedUrl(); } };
  const out = { intake: { url: short(f1), edit: f1.getEditUrl() }, consent: { url: short(f2), edit: f2.getEditUrl() }, sheet: ss.getUrl(), created: new Date().toISOString() };
  props.setProperty('FORMS_JSON', JSON.stringify(out)); return out;
}
function handle_(p) {
  if (!p || p.secret !== SECRET || SECRET.indexOf('PASTE-A-LONG') === 0) return { ok: false, error: 'unauthorised' };
  const a = p.action || 'ping';
  if (a === 'ping') return { ok: true, calendar: cal_().getName(), account: Session.getEffectiveUser().getEmail(), tz: TZ, time: new Date().toISOString() };
  if (a === 'freebusy') {                                             // between from/to (ISO) → busy: [[startMs, endMs], ...], open: bookable windows (OPEN events)
    const from = new Date(p.from), to = new Date(p.to); if (isNaN(from) || isNaN(to)) return { ok: false, error: 'bad range' };
    const busy = [], open = [];
    cal_().getEvents(from, to).forEach(function (e) {
      const span = [e.getStartTime().getTime(), e.getEndTime().getTime()];
      if (OPEN_RE.test(e.getTitle() || '')) { open.push(span); return; }
      if (e.getTransparency() !== CalendarApp.EventTransparency.TRANSPARENT && e.getMyStatus() !== CalendarApp.GuestStatus.NO) busy.push(span);
    });
    return { ok: true, busy: busy, open: open };
  }
  if (a === 'hold') {                                                 // tentative appointment: {start, end (ISO), title, description}
    const s = new Date(p.start), e = new Date(p.end); if (isNaN(s) || isNaN(e) || e <= s) return { ok: false, error: 'bad time' };
    const clash = cal_().getEvents(s, e).filter(function (x) { return x.getTransparency() !== CalendarApp.EventTransparency.TRANSPARENT && !OPEN_RE.test(x.getTitle() || ''); });
    if (clash.length) return { ok: false, error: 'slot taken' };
    const ev = cal_().createEvent(String(p.title || 'HOLD · New client'), s, e, { description: String(p.description || '') });
    ev.setColor(CalendarApp.EventColor.PALE_GREEN);
    return { ok: true, id: ev.getId(), link: 'https://calendar.google.com/calendar/u/0/r/day/' + Utilities.formatDate(s, TZ, 'yyyy/MM/dd') };
  }
  if (a === 'inbox') {                                                // {ref, kind, name, phone, who, age, returning, service, mode, slotLabel, preferred, message, hold, lang, channel, transcript}
    const ss = inbox_(), sh = ss.getSheetByName('Inbox') || ss.getSheets()[0], when = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    const S = function (v) { return v == null ? '' : String(v); };
    sh.appendRow([when, S(p.ref), S(p.kind), 'new', S(p.name), S(p.phone), S(p.who), S(p.age), S(p.returning), S(p.service), S(p.mode), S(p.slotLabel || p.slot), S(p.preferred), S(p.message), S(p.hold), S(p.lang), S(p.channel), '']);
    if (p.transcript) { const tr = ss.getSheetByName('Transcripts') || ss.insertSheet('Transcripts'); tr.appendRow([S(p.ref), when, S(p.transcript).slice(0, 45000)]); }
    return { ok: true, sheet: ss.getUrl(), row: sh.getLastRow() };
  }
  if (a === 'inbox_url') { return { ok: true, sheet: inbox_().getUrl() }; }
  if (a === 'inbox_update') {                                        // {ref, status, note} → updates the Status (and appends to the Message cell) of the Inbox row with that Ref
    const sh = inbox_().getSheetByName('Inbox'); const rows = rows_(sh); const hit = rows.filter(function (r) { return String(r.v[1]) === String(p.ref); }).pop(); if (!hit) return { ok: false, error: 'ref not found' };
    if (p.status) sh.getRange(hit.i, 4).setValue(String(p.status)); if (p.note) sh.getRange(hit.i, 14).setValue(String(hit.v[13] || '') + '\n— ' + String(p.note)); return { ok: true };
  }
  if (a === 'payment_create') {                                      // one row per payment link; the tick() trigger reminds and expires from here
    const sh = tab_(inbox_(), 'Payments', PAY_HEAD); const S = function (v) { return v == null ? '' : String(v); };
    sh.appendRow([S(p.ref), S(p.chargeId), 'pending', S(p.amount), S(p.name), S(p.phone), S(p.service), S(p.minutes), S(p.slot), S(p.slotLabel), S(p.eventId), Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), new Date(p.expiresAt).toISOString(), '', '', S(p.url), S(p.lang), '']); return { ok: true };
  }
  if (a === 'payment_status') {                                      // {ref | chargeId[, status]} → the row; with status (failed/declined…) records it without touching the hold
    const sh = tab_(inbox_(), 'Payments', PAY_HEAD); const hit = rows_(sh).filter(function (r) { return (p.ref && String(r.v[0]) === String(p.ref)) || (p.chargeId && String(r.v[1]) === String(p.chargeId)); }).pop(); if (!hit) return { ok: true, status: 'unknown' };
    if (p.status && hit.v[2] === 'pending' && p.status !== 'paid') sh.getRange(hit.i, 3).setValue(String(p.status));
    const v = hit.v; return { ok: true, status: p.status && v[2] === 'pending' ? p.status : v[2], ref: v[0], chargeId: v[1], amount: v[3], name: v[4], phone: v[5], service: v[6], minutes: v[7], slot: v[8], slotLabel: v[9], eventId: v[10], expires: v[12], url: v[15], lang: v[16] };
  }
  if (a === 'payment_paid') {                                        // idempotent: marks paid once, turns the HOLD into a confirmed event, returns the row for the confirmation message
    const sh = tab_(inbox_(), 'Payments', PAY_HEAD); const hit = rows_(sh).filter(function (r) { return (p.ref && String(r.v[0]) === String(p.ref)) || (p.chargeId && String(r.v[1]) === String(p.chargeId)); }).pop(); if (!hit) return { ok: false, error: 'payment row not found for ' + (p.ref || p.chargeId) };
    const v = hit.v; if (v[2] === 'paid') return { ok: true, already: true, ref: v[0] };
    sh.getRange(hit.i, 3).setValue('paid'); sh.getRange(hit.i, 15).setValue(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
    try { const ev = v[10] ? cal_().getEventById(String(v[10])) : null; if (ev) { ev.setTitle(ev.getTitle().replace(/^HOLD\s*·\s*/i, '✔ ')); ev.setDescription((ev.getDescription() || '').replace(/Status: awaiting payment[^\n]*/, 'Status: PAID ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') + ' (Tap ' + String(p.chargeId || '') + ')')); } } catch (e) {}
    try { const ib = inbox_().getSheetByName('Inbox'); const row = rows_(ib).filter(function (r) { return String(r.v[1]) === String(v[0]); }).pop(); if (row) ib.getRange(row.i, 4).setValue('paid · confirmed'); } catch (e) {}
    try { const pat = tab_(inbox_(), 'Patients', PAT_HEAD); const key = last8_(v[5]); const ex = rows_(pat).filter(function (r) { return last8_(r.v[0]) === key; }).pop(); if (!ex) pat.appendRow([String(v[5]), String(v[4]), '', '', '', '', '', 'created from payment ' + String(v[0]), '', '']); } catch (e) {}
    return { ok: true, ref: v[0], chargeId: v[1], name: v[4], phone: v[5], service: v[6], minutes: v[7], slot: v[8], slotLabel: v[9], eventId: v[10], lang: v[16] };
  }
  if (a === 'lookup_ref') {                                          // {ref} → {phone, name, lang, pickup} from Payments or Inbox (used to relay the doctor's replies)
    const ss = inbox_(); const pay = rows_(tab_(ss, 'Payments', PAY_HEAD)).filter(function (r) { return String(r.v[0]) === String(p.ref); }).pop(); if (pay) return { ok: true, phone: pay.v[5], name: pay.v[4], lang: pay.v[16], pickup: /yes|paper/i.test(String(pay.v[17])) };
    const ib = rows_(ss.getSheetByName('Inbox')).filter(function (r) { return String(r.v[1]) === String(p.ref); }).pop(); if (!ib) return { ok: true, phone: '' }; const msg = String(ib.v[13] || ''); return { ok: true, phone: ib.v[5], name: ib.v[4], lang: /[\u0600-\u06FF]/.test(msg + String(ib.v[4])) ? 'ar' : 'en', pickup: /paper copy|نسخة ورقية|pickup/i.test(msg) };
  }
  if (a === 'patient_lookup') {                                      // {phone[, name]} → Patients row + computed refill validity (last visit + 6 months). Name, when given, must share a word with the file.
    const pat = tab_(inbox_(), 'Patients', PAT_HEAD), key = last8_(p.phone); if (!key) return { ok: true, found: false };
    const hit = rows_(pat).filter(function (r) { return last8_(r.v[0]) === key; }).pop(); if (!hit) return { ok: true, found: false };
    const v = hit.v; if (p.name && v[1]) { const a1 = String(p.name).toLowerCase().split(/\s+/), b1 = String(v[1]).toLowerCase().split(/\s+/); if (!a1.some(function (w) { return w.length > 1 && b1.indexOf(w) >= 0; })) return { ok: true, found: false, reason: 'name mismatch' }; }
    const last = v[2] ? new Date(v[2]) : null, until = v[4] ? new Date(v[4]) : (last && !isNaN(last) ? addMonths_(last, REFILL_MONTHS) : null);
    return { ok: true, found: true, name: v[1], last_visit: last && !isNaN(last) ? iso_(last) : '', next_followup: v[3] ? iso_(new Date(v[3])) : '', refill_until: until && !isNaN(until) ? iso_(until) : '', refill_due: !!(until && !isNaN(until) && until >= new Date()), diagnosis: v[5], medications: v[6], notes: v[7] };
  }
  if (a === 'set_followup') {                                        // {phone, date (YYYY-MM-DD), note} from Dr. Bibi after a visit: last visit = today, next follow-up = date, refill valid 6 months
    const pat = tab_(inbox_(), 'Patients', PAT_HEAD), key = last8_(p.phone); if (!key || !p.date) return { ok: false, error: 'phone and date required' };
    const hit = rows_(pat).filter(function (r) { return last8_(r.v[0]) === key; }).pop(); const today = new Date(), until = iso_(addMonths_(today, REFILL_MONTHS));
    if (hit) { pat.getRange(hit.i, 3).setValue(iso_(today)); pat.getRange(hit.i, 4).setValue(String(p.date)); pat.getRange(hit.i, 5).setValue(until); pat.getRange(hit.i, 10).setValue(''); if (p.note) pat.getRange(hit.i, 8).setValue(String(hit.v[7] || '') + (hit.v[7] ? '\n' : '') + iso_(today) + ': ' + String(p.note)); return { ok: true, name: hit.v[1], refill_until: until }; }
    pat.appendRow([String(p.phone), '', iso_(today), String(p.date), until, '', '', p.note ? iso_(today) + ': ' + String(p.note) : '', '', '']); return { ok: true, name: '', refill_until: until };
  }
  if (a === 'find_by_phone') {                                       // upcoming appointments whose description carries this WhatsApp number (HOLD or confirmed). Name must match a word when given.
    const key = last8_(p.phone); if (!key) return { ok: true, appointments: [] }; const now = new Date(), to = new Date(now.getTime() + 120 * 864e5);
    const list = cal_().getEvents(now, to).filter(function (ev) { return !OPEN_RE.test(ev.getTitle() || '') && last8_((ev.getDescription() || '').replace(/[^\d]/g, ' ')) !== '' && (ev.getDescription() || '').replace(/\D/g, '').indexOf(key) >= 0; });
    const nameOk = function (ev) { if (!p.name) return true; const a1 = String(p.name).toLowerCase().split(/\s+/); return a1.some(function (w) { return w.length > 1 && (ev.getTitle() || '').toLowerCase().indexOf(w) >= 0; }); };
    return { ok: true, appointments: list.filter(nameOk).slice(0, 6).map(function (ev) { const t = ev.getTitle() || ''; return { id: ev.getId(), start: ev.getStartTime().toISOString(), end: ev.getEndTime().toISOString(), title: t, service: /follow/i.test(t) ? 'followup' : /psychother/i.test(t) ? 'psychotherapy' : /individual/i.test(t) ? 'therapy' : /marital|family|parental/i.test(t) ? 'family' : /external/i.test(t) ? 'external' : 'psychiatry', minutes: Math.round((ev.getEndTime() - ev.getStartTime()) / 60000) }; }) };
  }
  if (a === 'move') {                                                // {id, start, end, note} → moves the event if the new time is free; late = less than 24 h before the CURRENT time (policy applies)
    const ev = cal_().getEventById(String(p.id || '')); if (!ev) return { ok: false, error: 'not found' }; const s = new Date(p.start), e = new Date(p.end); if (isNaN(s) || isNaN(e) || e <= s) return { ok: false, error: 'bad time' };
    const late = ev.getStartTime().getTime() - Date.now() < RESCHEDULE_HOURS * 3600e3; if (late) return { ok: true, moved: false, late: true };   // clinic policy: rescheduling needs 48 h notice
    const clash = cal_().getEvents(s, e).filter(function (x) { return x.getId() !== ev.getId() && x.getTransparency() !== CalendarApp.EventTransparency.TRANSPARENT && !OPEN_RE.test(x.getTitle() || ''); }); if (clash.length) return { ok: true, moved: false, clash: true };
    const old = fmtKw_(ev.getStartTime()); ev.setTime(s, e); ev.setDescription((ev.getDescription() || '') + '\n' + (p.note || 'Rescheduled') + ' — previously ' + old);
    try { const pay = tab_(inbox_(), 'Payments', PAY_HEAD); const hit = rows_(pay).filter(function (r) { return String(r.v[10]) === String(ev.getId()); }).pop(); if (hit) { pay.getRange(hit.i, 9).setValue(Utilities.formatDate(s, TZ, "yyyy-MM-dd'T'HH:mm")); pay.getRange(hit.i, 10).setValue(fmtKw_(s)); } } catch (x) {}
    return { ok: true, moved: true };
  }
  if (a === 'tick') return tick_();
  if (a === 'create_forms') { const f = forms_(String(p.force || '') === '1'); return Object.assign({ ok: true }, f); }   // creates both forms once (force=1 makes new ones)
  if (a === 'set_forms') {                                          // register existing form links: &intake=<url>&consent=<url> (either may be omitted); the website picks them up within 10 minutes
    const props = PropertiesService.getScriptProperties(); const cur = JSON.parse(props.getProperty('FORMS_JSON') || '{}');
    if (p.intake) cur.intake = { url: String(p.intake), edit: cur.intake && cur.intake.edit || '' }; if (p.consent) cur.consent = { url: String(p.consent), edit: cur.consent && cur.consent.edit || '' };
    cur.updated = new Date().toISOString(); props.setProperty('FORMS_JSON', JSON.stringify(cur)); return Object.assign({ ok: true }, cur);
  }
  if (a === 'forms') { const have = PropertiesService.getScriptProperties().getProperty('FORMS_JSON'); return have ? Object.assign({ ok: true }, JSON.parse(have)) : { ok: true, intake: null, consent: null }; }
  if (a === 'cancel') { const ev = cal_().getEventById(String(p.id || '')); if (!ev) return { ok: false, error: 'not found' }; ev.deleteEvent(); return { ok: true }; }
  if (a === 'sheet_rows') {                                           // {sheetId, tab} → {values: [[...], ...]}   (patient register / logs — optional)
    const sh = SpreadsheetApp.openById(String(p.sheetId)).getSheetByName(String(p.tab || 'Patients')); if (!sh) return { ok: false, error: 'tab not found' };
    return { ok: true, values: sh.getDataRange().getDisplayValues() };
  }
  if (a === 'sheet_append') { const sh = SpreadsheetApp.openById(String(p.sheetId)).getSheetByName(String(p.tab || 'Updates')); if (!sh) return { ok: false, error: 'tab not found' }; sh.appendRow((p.row || []).map(String)); return { ok: true }; }
  return { ok: false, error: 'unknown action' };
}
function doGet(e) { try { return out_(handle_(e && e.parameter)); } catch (err) { return out_({ ok: false, error: String(err && err.message || err) }); } }
function doPost(e) { try { const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}; return out_(handle_(body)); } catch (err) { return out_({ ok: false, error: String(err && err.message || err) }); } }
