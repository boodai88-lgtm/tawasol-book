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
- **Google Calendar connector** (`api/src/calendar.js`): Google Cloud → enable Calendar API → create a service account → key JSON into the `GOOGLE_SA_JSON` secret → share the clinic calendar with the service-account email ("Make changes to events") → set `GOOGLE_CALENDAR_ID`. Grid hours come from settings `clinic_days`, `clinic_start`, `clinic_end`, `clinic_slot_min`, `clinic_lead_hours`.
- **Forms**: after a *first-visit* booking is sent, the assistant shares the intake form from `forms.intake` (EN/AR). Replace the `forms.gle/REPLACE-…` placeholders with real Google Forms. Suggested intake fields: full name · date of birth · WhatsApp number · who the appointment is for · visited before? · preferred language · main concern (free text) · current medication (yes/no + which) · previous diagnoses or treatment · how did you hear about us · consent to contact on WhatsApp. Consent form: confidentiality, cancellation policy (24 h), online-session terms, under-18 guardian consent. Payment stays with staff (UPayments link or at reception).
- **Clinical questions**: regex + LLM detection → validating reply → asks name + WhatsApp (web) → event `clinical` → stored in `enquiries` (kind `clinical`, question in `message`) → team WhatsApp alert → **reminders** every `clinical_reminder_hours` (4) up to `clinical_reminder_max` (3) until someone marks it answered (`POST /api/admin/enquiries/:id/answered`). Replying to the client happens on WhatsApp by Dr. Bibi or staff.
- **Voice notes**: on WhatsApp the Meta webhook delivers audio; transcription (Whisper or Google STT) is a stage-2 item once the WhatsApp channel is approved — not in the website phase.
- Migration `0004_calendar.sql` adds slot/calendar/reminder columns.
