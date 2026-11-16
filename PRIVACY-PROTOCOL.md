# Tawasol assistant — client data privacy & security protocol

**Owner:** Dr. Bibi Alamiri (privacy officer) · **Implementer:** Sulaiman Boodai (security officer) · **Version 1 · 12 Nov 2026 · for Dr. Bibi's approval**

This is the working procedure — what each person does, in testing and when live. The reasoning and the HIPAA-style framework sit in `COMPLIANCE.md`; this page is the checklist. Dr. Bibi Alamiri, as the licensed physician and privacy officer, approves it; no external legal review is required by Kuwaiti law for this document.

## 1. Roles and numbers in the automation
| Role in code | Number | Receives | Can send |
|---|---|---|---|
| `DOCTOR_WHATSAPP` — Dr. Bibi | +965 5060 3032 | client messages for the doctor, call requests, refill requests, clinical updates — each **with the patient-file context** (diagnosis, medications, last visit, notes) when the client is identified (number in the register, or passcode) | plain language: "tell Sara …", "Rx for Ahmed: …", "see Noura on 10 Dec", "passcode for Ahmed", "info on Sara" (§6). TW-XXXX is the reference number printed on each message she receives; replying "TW-XXXX: …" still works |
| `TEAM_WHATSAPP` — front desk | +965 9930 0074 (Sulaiman, during the pilot) → Juana's number at go-live | booking requests, paid confirmations, pickup/payment issues, urgent flags. Includes the client's own words, **never** the patient file | nothing automated yet (PAUSE/takeover command is next) |
| Test clients | Juana, Sulaiman's second line | the normal client flow | — |
| Clinic line 6668 9362 | — | not in the automation until Meta verification; then it becomes the **assistant's** number | — |

Change in Cloudflare → worker *aged-mud-dbb7* → Variables: `DOCTOR_WHATSAPP = 96550603032`, `TEAM_WHATSAPP = 96599300074` → Deploy. Both numbers must be in Meta's 5-recipient test list until the clinic number is live.

## 2. Where client data lives — and where it must not
| Data | Lives in | Who can open it |
|---|---|---|
| Patient register (name, WhatsApp, last visit, next follow-up, refill window, diagnosis, medications, notes) | **Patients** tab of *Tawasol Inbox* (clinic Google account) | Dr. Bibi, Juana; the bridge script reads it on the Worker's request |
| Enquiries, bookings, messages to the doctor | **Inbox** tab | Dr. Bibi, Juana, Sulaiman (pilot) |
| Payment links & status (no card data) | **Payments** tab + Tap dashboard | Juana, Sulaiman |
| Live conversation state | Cloudflare KV, 24 h, then gone | nobody reads it; diag page shows the last 20 technical events (no message bodies beyond 60 characters) |
| Calendar holds and confirmed slots (name + service) | Clinic Google Calendar | Dr. Bibi, Juana |
| Words the assistant generates | Anthropic API, **no training, no retention** beyond the request | — |
| WhatsApp message transit | Meta (end-to-end encrypted in transit; Meta signs no BAA) | — |

**Never:** patient-file fields on the website, in team alerts, in emails, in GitHub, in screenshots shared for testing. The Worker code enforces the first three; people enforce the rest.

## 3. Testing phase — rules (now)
1. **No real patient data in tests.** Test with your own names and numbers. If a real client reaches the test number by accident, Juana records the enquiry manually and the test row is deleted from Inbox/Patients the same day.
2. **Screenshots for review are redacted** (crop or blur names and numbers) before being sent in any group chat or to me. Delete them from the phone's camera roll after use.
3. **Seed the Patients tab with fake rows only** (e.g. "Test Patient A"). Real rows are entered by Juana only after go-live approval.
4. Test payments: Tap test key or a KD 1 real charge that is refunded the same day; receipts go to the tester's own phone.
5. Tokens and keys are shared only inside Cloudflare → Variables (encrypted) or a password manager — never in WhatsApp, email or this chat. Rotate any key that was ever pasted into a message.
6. Weekly during the pilot: Sulaiman clears KV trace, deletes test HOLDs from the calendar, and empties test rows.

## 4. Live phase — rules
**Access**
- Google account of the clinic: 2-step verification on; sharing of *Tawasol Inbox* and the calendar limited to Dr. Bibi, Juana (and Sulaiman only while under contract — remove on offboarding). No "anyone with the link".
- Cloudflare, Meta Business, Tap, Anthropic: clinic-owned accounts, two-factor on, Sulaiman as additional admin, never sole owner. Recovery email = clinic Gmail.
- Phones that receive client data (Dr. Bibi, Juana): screen lock, Face/Touch ID, WhatsApp two-step PIN, **WhatsApp chat backup to iCloud/Google Drive turned off** for the clinic threads (or end-to-end encrypted backup enabled), lost-phone wipe enabled.

**Minimum necessary**
- The assistant tells the client only: *found / not found, refill valid until, next follow-up date*. Diagnosis and medications go only to Dr. Bibi's number.
- Team alerts carry the client's message, not the file. Juana opens the Inbox sheet for details.
- Prescriptions (`RX`) are sent to the client as text; physical copies are collected at the clinic after ID check.

**Consent & notice**
- The intake form (already in use) is extended with one sentence: *"Tawasol uses WhatsApp for appointment and clinical follow-up messages. You may ask for phone contact instead at any time."* — Arabic and English.
- The assistant's first message to a new number states that it is a virtual assistant and that messages are read by the clinic team.
- Privacy page (`legal.html`) describes exactly the table in §2. Dr. Bibi approves the text.

**Retention**
- KV conversation state: 24 h (automatic). Inbox rows: 2 years, then archive offline. Patients tab: for the duration of care + 5 years (Kuwait MoH medical-record practice — confirm with the adviser). Payments: 10 years (commercial). Audit/trace: 90 days.
- Quarterly: Juana exports Inbox and Payments to the clinic's encrypted drive, then purges rows past retention.

**Incidents** — any of: lost phone, wrong recipient, suspected account breach, leaked key.
1. Within 1 hour: tell Dr. Bibi and Sulaiman.
2. Within 24 hours: rotate the affected secret (WhatsApp token, Tap key, bridge secret, Anthropic key), sign out the device (Google → Security → devices; WhatsApp → Linked devices), change the Google password.
3. Record what data could have been seen, by whom, for how long; Dr. Bibi decides whether affected clients are told (default: yes, by phone).
4. Within 7 days: short written note in the clinic's incident log.

**Offboarding anyone** (staff or contractor): remove from Google sharing, Cloudflare, Meta portfolio, Tap team; rotate `GCAL_BRIDGE_SECRET` and `META_VERIFY_TOKEN`; change `TEAM_WHATSAPP` if it was their phone.

## 5. Client identity — when a passcode is needed and when it is not
**Principle: booking stays effortless; only clinical content asks for proof.**

| Task | Identity check | Why |
|---|---|---|
| Book, reschedule, fees, location, questions | none — name and WhatsApp number as today | nothing from the file is revealed; payment confirms the booking |
| Message for Dr. Bibi, clinical update, refill request **from a number that is in the Patients register** | none — the number is the identity (WhatsApp already verified the phone) | same channel the clinic uses with the client |
| The same tasks **from an unknown number** (new phone, relative's phone, website chat) | **personal passcode** (looks like TW-1234) — or "No passcode" to send as a new contact without the file | prevents someone else's file being attached to a stranger's message |
| Website secure form (tawasol.me → *Update for Dr. Bibi*) | passcode + the WhatsApp number on file | the browser cannot prove a phone number |

**How a passcode is created and given.** Dr. Bibi writes "passcode for Ahmed" to the assistant → it creates TW-#### in the client's row (once) and shows it to her. She, or the coordinator, gives it **in person at the first visit (printed card) or by voice call** — never by WhatsApp message, email or SMS. Lost passcode: the client calls the clinic, the coordinator confirms identity (name, date of last visit, date of birth) and reads the code out; the assistant can also issue a new one on Dr. Bibi's instruction ("new passcode for Ahmed"), which replaces the old one.

**Why not usernames and passwords.** Clients forget them, reset flows need email (which we deliberately don't collect), and a reset-by-WhatsApp would make the password no stronger than the number itself. One short code, kept in the clinic's register, that is only ever typed and never stored on the client's device, is easier and safer for this use.

**Protections built in.** 5 wrong attempts lock the check for 15 minutes; the website never receives any file field — a correct passcode returns only "found" and a first name; every passcode use is logged in the Inbox with the reference; a passcode never unlocks booking or payment (there is nothing to unlock).

## 6. Dr. Bibi's natural-language channel
She writes to the assistant in her own words — "tell Sara the dose stays the same", "Rx for Ahmed: …", "see Noura again on 10 December", "passcode for Ahmed", "info on Sara". The assistant resolves the client in the register; if two clients share the name it offers buttons with name + masked number and waits for her choice; if none is found it asks for the spelling or the number. The old exact commands (TW-XXXX: …) keep working. Only Dr. Bibi's number can use this channel.

## 7. Connecting the client database (what exists, what's next)
Today the assistant already reads the **Patients** tab by WhatsApp number: for refill and doctor-message requests it attaches diagnosis, medications, last visit and notes to the message Dr. Bibi receives; it tells the client only whether a refill is still within the 6-month window. After each visit Dr. Bibi sends `FU 9655xxxxxxx 2026-12-01 note` and the register updates itself.

To make this a real patient background rather than a sheet:
1. **Now** — Juana fills the Patients tab for active clients (WhatsApp number as written by the client, name, last visit, diagnosis, medications, notes). One row per client; the number is the key.
2. **Next** — a protected **Patient card** in the admin dashboard (search by number, see the file, add a note) so nobody edits the sheet by hand; audit of every view.
3. **Later** — if the clinic adopts an EHR, the bridge reads from it instead of the sheet; the assistant does not change.

## 8. Dr. Bibi's sign-off
- [ ] Roles and numbers (§1) · [ ] Testing rules (§3) · [ ] Live rules (§4) · [ ] Passcode policy (§5) · [ ] Retention periods · [ ] Consent sentence wording

## Addendum — 16 Nov 2026: the website discloses nothing
Raised by Dr. Bibi during testing. The public website cannot prove who is typing, so it never shows or changes anything tied to a client's file: no name, refill date or appointment is displayed, and no appointment is moved there. Refill and appointment-change requests typed on the website are passed on and answered on WhatsApp at the number in the file. A prescription sent with the prescription command (“RX TW-XXXX: …” or “Rx for …”) goes only to a number that is in the Patients register; for any other number the assistant refuses and tells Dr. Bibi. An ordinary reply can still go to anyone who wrote in — that is how new enquirers get an answer — so her alert states in capitals when there is no file under the number, and medication details should not be put in a plain reply to such a number. Dr. Bibi's alert states whether the request came from the website or WhatsApp and warns when the typed name differs from the name on file.
