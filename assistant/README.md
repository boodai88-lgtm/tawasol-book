# Tawasol — the clinic's virtual receptionist

A calm, bilingual (EN/AR) assistant that greets visitors, answers practical questions, takes appointment requests and messages, and hands anything clinical or urgent to people. One conversation engine runs in three places: the website chat, WhatsApp, and Instagram DMs.

## What she does — and deliberately doesn't
- Introduces herself as a **virtual assistant, not a clinician**, and says that what's shared goes only to the clinic team.
- **Books**: who the visit is for → name → first visit or returning → service → clinician → in person / online → preferred days & times → WhatsApp number → optional note → summary → *Send request*. On WhatsApp the number is already known, so that step is skipped. She never promises a slot; the team confirms the time (`confirmWindow`).
- **Answers** hours, location, fees policy, online sessions, first-visit expectations, insurance, languages, children, privacy, and the guidebook — only from `clinic-config.js`. Anything unknown → "the team will confirm".
- **Refuses clinical advice** (medication, dosage, diagnosis) and offers an appointment or an urgent message instead.
- **Crisis protocol** (deterministic, runs before any AI): self-harm or danger language → emergency guidance (`emergency`, optional `urgentLine`) + *Ask team to call me* (creates an **urgent** enquiry, emailed with "URGENT" and tinted red in the admin) / *I'm safe, continue*.
- **Human handoff**: "can I talk to someone" → takes a message and number.
- Switches language when the visitor does; Arabic uses proper RTL.

Two modes, same words: **scripted** (buttons + keyword matching — what the GitHub preview runs) and **AI-assisted** (Claude understands free text, fills booking fields it hears "in passing", and follows the same rules). The AI only produces the *wording*; the booking state, buttons, crisis handling and what gets sent are decided by the engine, so a model mistake can't book, promise, or skip safety.

## Files
- `clinic-config.js` — every fact she may state. Items marked `[confirm]` are placeholders: address, hours, phone, fees policy, online sessions, first-visit length, minors policy, insurance, languages.
- `engine.js` — the conversation (state machine, cue texts EN/AR, crisis/clinical/human detectors, Claude prompt). No DOM; identical in browser and Worker.
- `widget.js` / `widget.css` — the website chat UI (bubbles, chips, summary card, typing indicator, language switch, session memory).
- `../chat.html` — the page. `?embed=1` strips the site chrome for an iframe; `?channel=inbox` previews the messaging-inbox rendering (≤3 buttons, lists, text summaries).
- `../../api/src/assistant.js` — `/api/assistant/complete` (LLM proxy; the server rebuilds the system prompt, so the key can't be misused), `/api/assistant/requests`, `/api/assistant/webhook/meta`, admin enquiries. Migration `0003_assistant.sql`.

## Embedding on the clinic website
```html
<iframe src="https://<your-site>/chat.html?embed=1" title="Chat with Tawasol" style="width:100%;height:640px;border:0;border-radius:20px"></iframe>
```
Or mount inline: include `assistant/widget.css`, `config.js`, `assistant/clinic-config.js`, `assistant/engine.js`, `assistant/widget.js`, then `<div data-tawasol-chat data-lang="ar"></div>`.

## WhatsApp — what "embedding" really means
WhatsApp and Instagram don't host widgets; a business connects a bot to its inbox through Meta's APIs. The same engine answers there, with the UI translated to what each inbox allows.

1. **Meta Business Suite** → create (or use) a Meta app with the *WhatsApp* product. You need a Meta Business account verified for the clinic and a phone number not currently registered on the WhatsApp app (or migrate it).
2. Deploy the API, then **Webhook**: callback `https://<api>/api/assistant/webhook/meta`, verify token = your `META_VERIFY_TOKEN`; subscribe to `messages`.
3. Secrets on the Worker: `WHATSAPP_TOKEN` (a *System User* permanent token with `whatsapp_business_messaging`), `WHATSAPP_PHONE_ID`, `META_APP_SECRET` (signature check), `ANTHROPIC_API_KEY` (optional).
4. Rules to know: you may reply freely within **24 hours** of the customer's last message; after that only pre-approved **template** messages — relevant if the team wants to send the confirmation from the same number. Interactive buttons: max 3, titles ≤ 20 characters; lists: ≤ 10 rows, titles ≤ 24 characters (the engine formats for this).

## Instagram
1. The clinic's Instagram must be a **Professional** account linked to a Facebook Page; the Meta app needs the *Instagram* product (messaging) and `instagram_manage_messages` through **App Review** before it works for the public.
2. Same webhook URL; subscribe the Page/IG account to `messages`.
3. Secrets: `IG_TOKEN` and `IG_SEND_BASE` — `https://graph.facebook.com/v21.0/<PAGE_ID>` for the Facebook-Login setup, or `https://graph.instagram.com/v21.0/<IG_USER_ID>` for the Instagram-Login setup. Quick replies: ≤ 13, titles ≤ 20 characters.
4. Also a 24-hour window; "human agent" extensions exist but aren't used here.

Both channels keep a per-person session in `assistant_sessions` (booking state + last turns), de-duplicate Meta's repeated deliveries via `assistant_events`, and store results in `enquiries` (Admin → Enquiries, emailed to `clinic_email`/`support_email`).

## Safety, privacy, honesty
- She is labelled as an assistant at the start and in the footer; emergency numbers are present, never invented beyond `112` — add the clinic's own urgent line in `urgentLine`.
- Conversations are stored for the team (so a message isn't lost); say so in the privacy page before launch. Transcripts are kept with the enquiry (last 20 turns) and should be deleted on a schedule — decide the retention period.
- The AI never sees anything but the conversation and the config; no patient records are connected.
- Not a triage tool: she does not assess risk beyond the keyword protocol. Review the keyword lists in `engine.js` with Dr. Bibi.

## To confirm before going live
Address, hours, phone, services list and names, clinicians, fees policy, online sessions yes/no, first-visit length, under-18 policy, insurance, languages, confirmation window, and the **team WhatsApp number** that receives every enquiry (Admin → Settings → *Team WhatsApp*; an email copy is optional).

## Contact policy
Clients are never asked for an email. The assistant collects a **name and WhatsApp number** only (on WhatsApp itself the number is already known, so it is not asked again). The team is alerted on WhatsApp and replies to the client on WhatsApp.


## Appointments, calendar and forms (website phase)
Dr. Bibi's brief (Oct 2026): empathetic/validating replies · detect clinical questions, answer kindly, forward to her with reminders · detect appointment requests and book into free calendar slots · Arabic + English · payments & intake handled by staff. Website first; WhatsApp/Instagram after approval.

- **Where it lives**: `clinic.html` ("Clinic" in the menu) — chat inline, next available times, forms, urgent note. The floating launcher is off on the home page and shows on the other pages.
- **Slots**: `scheduler.js`. DEMO (no api): a simulated Google Calendar from the `calendar` block in `clinic-config.js` (Sun–Thu 10:00–18:00, 50-min slots, some pre-blocked, bookings remembered in the browser; `TawasolScheduler.clearDemo()` resets). LIVE: `GET /api/assistant/slots` reads Google Calendar free/busy; a booking creates a **tentative "HOLD" event** with the client's details, which the team confirms or deletes in Google Calendar.
- **Google Calendar connector** (`api/src/calendar.js`, and the same in `api/assistant-worker.js`). Two backends, auto-detected. **Bridge (recommended, Gmail-based clinic account, no Google Cloud):** paste `api/google-calendar-bridge.gs` into script.google.com as the clinic account → set its `SECRET` → Deploy as web app (execute as me, access: anyone) → copy the `/exec` URL → worker vars `GCAL_BRIDGE_URL` + `GCAL_BRIDGE_SECRET`. Check with `<worker>/api/assistant/calendar-check`. **Service account (Workspace orgs):** `GOOGLE_SA_JSON` + `GOOGLE_CALENDAR_ID`, calendar shared with the service-account email. Slots = clinic grid (`CLINIC_DAYS/START/END`, `SLOT_MIN`, `LEAD_HOURS` on the stand-alone worker; settings on the full API) minus busy events; a booking creates a pale-green **HOLD ·** event the team confirms or deletes. The bridge also serves the patient Sheet (`sheet_rows` / `sheet_append`) so no Google key is needed anywhere.
- **Which hours are offered** — three layers, no code: (1) **Clinic hours** (Dr. Bibi, 3 Nov 2026): Sunday–Thursday 15:00–20:00 — free times inside them are offered automatically; set with `CLINIC_DAYS/START/END` (stand-alone worker) or the `clinic_*` settings (full API). (1b) **OPEN events** optionally narrow the offer: create an event titled `OPEN` (or `متاح`) covering the hours to offer, e.g. 16:00–20:00, repeat weekly on the chosen days; when any OPEN event exists in the next ~10 days, times are offered *only* inside those windows. (2) **Anything else on the calendar blocks time** — holidays, meetings, HOLD events. (3) With no OPEN events the clinic hours apply: `CLINIC_DAYS` (0=Sun), `CLINIC_START`, `CLINIC_END`, `SLOT_MIN`, `LEAD_HOURS` on the stand-alone worker (Admin → Settings on the full API). Slot length follows the service — consultation `SLOT_MIN` (50), follow-up `FOLLOWUP_MIN` (25) — and the earliest offer is `LEAD_HOURS` (20) ahead. A 25-minute follow-up and a 50-minute consultation can share one OPEN window; HOLD titles show the length.
- **Forms**: after a *first-visit* booking is sent, the assistant shares the intake form from `forms.intake` (EN/AR). Replace the `forms.gle/REPLACE-…` placeholders with real Google Forms. Suggested intake fields: full name · date of birth · WhatsApp number · who the appointment is for · visited before? · preferred language · main concern (free text) · current medication (yes/no + which) · previous diagnoses or treatment · how did you hear about us · consent to contact on WhatsApp. Consent form: confidentiality, cancellation policy (24 h), online-session terms, under-18 guardian consent. Payment stays with staff (UPayments link or at reception).
- **Clinical questions**: regex + LLM detection → validating reply → asks name + WhatsApp (web) → event `clinical` → stored in `enquiries` (kind `clinical`, question in `message`) → team WhatsApp alert → **reminders** every `clinical_reminder_hours` (4) up to `clinical_reminder_max` (3) until someone marks it answered (`POST /api/admin/enquiries/:id/answered`). Replying to the client happens on WhatsApp by Dr. Bibi or staff.
- **Voice notes**: on WhatsApp the Meta webhook delivers audio; transcription (Whisper or Google STT) is a stage-2 item once the WhatsApp channel is approved — not in the website phase.
- Migration `0004_calendar.sql` adds slot/calendar/reminder columns.


## Connecting Claude for the website test (no full backend yet)
1. Get an Anthropic API key (console.anthropic.com → API keys).
2. Cloudflare dashboard → Workers & Pages → Create → Hello World → *Edit code* → paste `api/assistant-worker.js` → Deploy.
3. Worker → Settings → Variables: secret `ANTHROPIC_API_KEY`; var `ALLOWED_ORIGINS` = `https://boodai88-lgtm.github.io`; optional `ENQUIRY_WEBHOOK_URL` = an n8n/Make webhook that should receive bookings, questions and clinical requests (JSON) — e.g. to post them to the clinic WhatsApp or a Google Sheet.
4. `web/config.js` → `assistantApi: "https://<worker>.<account>.workers.dev"` → upload config.js to GitHub.
Result: Tawasol answers free text naturally with Claude (model `claude-sonnet-4-5`, ≤700 tokens, 20 requests/min per visitor), still inside the receptionist rules (no clinical advice, crisis script, booking steps). Cost is roughly KD 0.003–0.01 per conversation. The scripted flow remains as fallback when the worker is unreachable.
Inside this design workspace the preview already uses Claude automatically (no key needed) — that's the behaviour the worker reproduces on the live site.


## Patient context, passcodes and the secure inbox (Nov 2026 — Dr. Bibi's requests)
- **Intake order**: beneficiary first — full name → age → *"What is your relationship to {name}?"* (Myself / My child / Other — write) → visited before → service → clinician → mode → time → WhatsApp → reason.
- **Location** is never given by the assistant; it says the team sends it with the confirmation.
- **Send an update to Dr. Bibi** (new menu item): the client types the personal **passcode** the clinic gave them (any phone/device works), writes the update, and it lands — with the patient-file columns from the clinic's **Google Sheet** — in the admin **Inbox**. Mentions of medication flag the row and also ping the **nurse** (Settings → Nurse WhatsApp). Alerts to WhatsApp contain only a reference; details stay in the inbox. Demo passcode without a sheet: **TW-1234**.
- **Sheet layout** (tab `Patients`): `File no | Name | Passcode | WhatsApp | Age | Clinician | Diagnosis | Current medication | Allergies | Last visit | Next appointment | Notes for assistant` — only the columns named in Settings are read. Updates are appended to an `Updates` tab. Setup: `GOOGLE_SHEET_ID` + the same service account as the calendar (share the sheet with it) + `PHI_KEY` secret. Migration `0005_patients.sql`.
- Security framework, vendor agreements and open decisions: **COMPLIANCE.md** (hub root).


## Clinic facts loaded from the team's current templates (1 Nov 2026)
- Response promise: the assistant answers instantly; the **24 hours on business days (Sunday–Thursday)** applies only to human follow-up (confirming the time, payment, Dr. Bibi’s replies). Urgent concerns → nearest polyclinic (now in the assistant's answers alongside 112 for emergencies).
- Fees: Psychiatric Clinical Diagnostic Interview KD 220 · 50 min · all ages; Follow-up KD 120 · 25 min · all ages. Advance payment confirms a booking. Scheduling follows the doctor's availability.
- Cancellation: same-day cancellation/rescheduling may forfeit the fee; 24 hours' notice.
- Location: MEDC2 Complex, Sabah Al-Salem, Block 1, Street 106, 7th floor, beside AlMezzan Pharmacy — https://maps.app.goo.gl/ndSysaztJUuQsEbS8 — **sent by the team only after payment/confirmation**, never by the assistant.
- Team's confirmation message (sent manually after payment): *"Thank you for your payment. Your appointment is confirmed for {day}, {date} at {time}. Please note that same-day cancellations or rescheduling may result in the session fee being forfeited. Kindly provide at least 24 hours' notice for any changes. Location: … 📍 map link"* — kept as the staff template; the admin can later send it from the Inbox with one tap (phase 2).


## Decision log
- **1 Nov 2026 — WhatsApp may carry clinical questions and updates** (Dr. Bibi). Team alerts now include the client's question text by default (`alerts_include_details` = 1, Admin → Settings). The encrypted inbox remains the record of truth; see COMPLIANCE.md §7.


## Inbox (pilot)
With the stand-alone worker, every request the assistant takes (booking, question, clinical update, urgent) is appended to a Google Sheet **“Tawasol — Inbox”** in the clinic Google account through the same Apps Script bridge (`inbox` action): one row per request with name, WhatsApp, service, chosen time, preferred times, message, calendar-hold link and a **Status** column (new / contacted / booked / closed) that the team uses as its queue; the full chat goes to a *Transcripts* tab. First use creates the sheet — `<worker>/api/assistant/inbox-check` returns its link; share it with the team. The sheet contains client details and may contain clinical text: keep sharing to named staff only, no link-sharing. The full API (D1 + admin inbox, encrypted) replaces this at go-live.

- **6 Nov 2026 — Dr. Bibi's review (implemented 7 Nov).** Replies are re-voiced by the model in context ("humanized": same meaning, numbers and question; links and the crisis text stay verbatim). One window: no "team"/"receptionist" — "we" and "I". Reason question: «أخبرني باختصار بسبب الزيارة» with «لا أرغب»; after sharing → «شكراً لمشاركتك، سنحرص على أن تطّلع الطبيبة عليه قبل الموعد». Services: Psychiatric consultation (KD 220 · 50 min · Dr. Bibi), Follow-up (KD 120 · 25 min · Dr. Bibi), Psychotherapy (KD 70 · 50 min · psychologist) — no "all ages"; details unfold per chosen service. Summary card: patient name, service + duration, provider, time, fee, WhatsApp, reason; confirm = «هل كل شيء صحيح؟» / «نعم، احجز». Phone: «ما رقم الواتساب الأنسب؟» or, on WhatsApp, «هل نستخدم هذا الرقم أم تفضّل رقماً آخر؟». ONE form, sent only after payment with the confirmation + location. Payment link (Tap) at booking, 24 h to pay, reminder 2 h before, hold released automatically; no payment at the clinic. Reschedule flow (finds the appointment by name + number, offers free times, <24 h → policy note). "Talk to the doctor" → message relayed to Dr. Bibi (reply within 24 h) or a 3–5 min call on request; her WhatsApp replies are relayed back. Medication refill: valid 6 months after the last follow-up (Patients tab), request goes to Dr. Bibi with the file, prescription relayed, paper copy collectable in opening hours; expired → offer a follow-up. Follow-up prompts: Dr. Bibi sends «FU <number> <date>» → the client is prompted a week before. Emergency line everywhere: «في حالات الطوارئ يرجى الاتصال على ١١٢».

## Payments (Tap) — how it is wired
1. Tap dashboard (goSell) → *Developers → API keys*: copy the **test secret key** (sk_test_…) → worker variable `TAP_SECRET_KEY`. Later swap for sk_live_….
2. Nothing else to configure at Tap: the worker creates each charge with its own `post` (webhook) and `redirect` URLs — `<worker>/api/assistant/pay/webhook` and `<site>/pay-return.html`.
3. Flow: hold in calendar → Tap charge (KWD, 3 decimals, KNET + cards via `src_all`) → link shown in the chat (and WhatsApp when connected) → client pays on Tap's hosted page → Tap POSTs the webhook → the worker **re-fetches the charge** (never trusts the redirect or the webhook body alone) → `payment_paid` in the Payments tab → HOLD becomes ✔ → confirmation with form + location + 24 h policy on WhatsApp → team alert.
4. Reminders/expiry: Apps Script trigger `tick` every 15 min (run `installTriggers()` once) — reminder at T−2 h, expiry at T → hold deleted, client told kindly.
5. Test with Tap's test cards (dashboard → Testing) before going live. Expected: `…/api/assistant/pay/status?ref=TW-…` shows `paid` and the calendar title flips to ✔.

- **7 Nov 2026 — fee list (updated 2025) applied.** Services follow the clinic's list exactly: Psychiatric clinical diagnostic interview 50 min KD 220 (first visits) · Psychiatric follow-up 20 min KD 120 (medication management + supportive therapy and/or brief parental guidance and psychoeducation) · Individual therapy 20 min KD 120 · Marital or family therapy / parental guidance 50 min KD 220 · External consultation KD 220 per 50 min + KD 50 travel (arranged manually, no instant link) · Psychotherapy with the psychologist 50 min KD 70 — **returning clients only, by referral from Dr. Bibi**; a first-visit client asking for it is guided to the diagnostic interview. [confirm: can Individual therapy and Marital/family therapy be booked as a first visit? Currently: individual = returning only, family = both.] The cancellation policy (verbatim, EN/AR) is sent before every payment link and in the confirmation; rescheduling needs **48 h** (inside 48 h the assistant notes the request instead of moving it); fees non-refundable.

- **7 Nov 2026 — calendar padding** (Dr. Bibi): a 50-minute session blocks **1 hour** and a 20-minute session blocks **30 minutes** on the calendar. Free times are offered on that padded grid and holds are created with the padded length; the client still sees 50 / 20 minutes.
