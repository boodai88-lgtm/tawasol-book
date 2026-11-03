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
 *  After editing this file later: Deploy → Manage deployments → ✎ → Version: New version → Deploy (same URL).
 */
const SECRET = 'PASTE-A-LONG-RANDOM-SECRET-HERE';
const CALENDAR_ID = 'primary';
const TZ = 'Asia/Kuwait';
/* Events whose title starts with one of these words are BOOKABLE WINDOWS, not appointments: the assistant offers times only inside them.
   Example: an event "OPEN" from 16:00 to 20:00 repeating weekly on Sun/Tue/Thu. Delete all OPEN events to go back to the default grid. */
const OPEN_RE = /^\s*(open|available|bookable|متاح|مفتوح)\b/i;

function cal_() { const c = CALENDAR_ID === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CALENDAR_ID); if (!c) throw new Error('Calendar not found: ' + CALENDAR_ID); return c; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
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
