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
 *  After editing this file later: Deploy → Manage deployments → ✎ → Version: New version → Deploy (same URL).
 */
const SECRET = 'PASTE-A-LONG-RANDOM-SECRET-HERE';
const CALENDAR_ID = 'primary';
const TZ = 'Asia/Kuwait';
/* Inbox: every booking, question, clinical update and urgent request from the assistant is appended to this spreadsheet (created in the clinic Drive the first time;
   or paste the ID of an existing sheet). Tabs: Inbox (one row per request — Juana works from the Status column), Transcripts (the chat, for context). */
const INBOX_SHEET_ID = '';
const INBOX_NAME = 'Tawasol — Inbox';
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
