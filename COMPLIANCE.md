# Tawasol — privacy & security framework (HIPAA-style)

**Status: for Dr. Bibi's approval as privacy officer. Not legal advice.** HIPAA is a United States law; it does not apply in Kuwait by itself, and nobody can "certify" a website or an assistant as HIPAA-compliant. What we do is adopt the HIPAA Security Rule as our working standard — administrative, physical and technical safeguards — because it is the clearest one written for a clinic, and layer Kuwait's own requirements on top (Ministry of Health confidentiality rules, Kuwait's electronic-transactions and data rules, and the conditions of the clinic's licence). No law requires an external legal review of this document; Dr. Bibi Alamiri, the licensed physician, is the approving officer.

**Scope.** The Tawasol assistant (website chat and WhatsApp), the clinic's Google Calendar and *Tawasol Inbox* spreadsheet, Tap Payments for appointment fees, and the tawasol.me website. The clinic sells no goods: the guidebook and audiobook are sold by Amazon and other book platforms under their own terms, so no book orders, shipping addresses or reader accounts exist in our systems.

## 1. What counts as protected health information (PHI) here
| Data | Where it lives | PHI? |
|---|---|---|
| Appointment requests — name, WhatsApp number, who the visit is for, service, preferred time, reason for the visit | *Tawasol Inbox* → **Inbox** tab (clinic Google account) | **Yes** (reason for a psychiatry visit) |
| Messages for the doctor, call requests, refill requests, clinical updates | **Inbox** tab; relayed to Dr. Bibi's WhatsApp | **Yes** |
| Patient register — last visit, next follow-up, refill window, diagnosis, medications, notes | **Patients** tab, maintained by the clinic | **Yes** |
| Appointment holds and confirmed slots (name + service) | Clinic Google Calendar | **Yes** (a psychiatry appointment is health information) |
| Payment links and status — reference, amount, name, number; **no card data** | **Payments** tab + Tap dashboard | Personal and financial data; card data never touches our systems (Tap hosted page) |
| Live conversation state | Cloudflare KV, 24 hours, then deleted | **Yes** while it exists |
| Technical event log (last 20 events, no message bodies) | Cloudflare KV | No |

## 2. Data-flow rules implemented
- **Minimum necessary.** The client is told only *found / not found, refill valid until, next follow-up date*. Diagnosis, medications and notes travel only to Dr. Bibi's number (`DOCTOR_WHATSAPP`). Front-desk alerts (`TEAM_WHATSAPP`) carry the client's own message, never the patient file. The website never receives patient-file fields.
- **Identification.** Booking needs no identity check (nothing from the file is revealed). For clinical content the WhatsApp number is the identity when it is already in the Patients register; from an unknown number or the website the client types a personal **passcode** (TW-####, created on Dr. Bibi's instruction, handed over in person or by voice, never sent electronically) or proceeds without the file. 5 wrong attempts lock the check for 15 minutes; a correct code returns only "found" and a first name to the website. Usernames/passwords were rejected: they need email for resets and add friction without adding safety.
- **Encryption.** TLS in transit everywhere. Google encrypts the sheet and calendar at rest; Cloudflare encrypts KV and secrets at rest. Keys and tokens exist only as Cloudflare encrypted variables.
- **Payment separation.** The Worker creates a Tap charge (amount, KWD, reference) and receives only a status; Tap's hosted page handles the card or KNET entry, so PCI-DSS scope stays with Tap. Every webhook is verified by re-fetching the charge from Tap before an appointment is confirmed.
- **Audit trail.** Every enquiry, booking, payment and doctor relay is a timestamped row in the Inbox sheet with its reference (TW-XXXX); the Worker keeps a 20-event technical log. Google keeps the sheet's version history (who edited what).
- **Access control.** Named people only: Dr. Bibi, the coordinator (Juana), Sulaiman during the pilot. No shared passwords; Google 2-step verification; two-factor on Cloudflare, Meta, Tap and Anthropic.
- **No PHI in the LLM beyond the conversation.** Claude receives the conversation and the clinic's public facts (services, fees, hours, policies) — never the patient register. API use, not a consumer app; no training on the data.
- **Retention.** Conversation state 24 h (automatic). Proposal: Inbox rows 2 years; Patients register duration of care + 5 years (MoH practice); Payments 10 years (commercial); technical log 90 days. *Decision needed.*

## 3. Google Sheet as the patient register (interim)
Works today with the clinic's own Google account. Requirements: 2-step verification on the account; the sheet and calendar shared only with named people; "anyone with the link" disabled; version history kept. The Apps Script bridge inside the account is the only door the Worker uses, and it opens only with a shared secret. **Longer term** a protected Patient card in the admin dashboard (audited reads, no hand edits) or a proper electronic health record is safer than a spreadsheet — the sheet is the bridge, not the destination.

## 4. Vendors — confirm written terms before PHI flows at scale
HIPAA requires a Business Associate Agreement (BAA) with every vendor that touches PHI. In Kuwait no such contract is legally required, but the same question — *what does this vendor do with our data?* — must be answered for each:
| Vendor | Role | What to confirm |
|---|---|---|
| Google (Sheets, Calendar, Forms, Apps Script) | patient register, calendar, intake form | Google Workspace offers a HIPAA BAA in the admin console; on a plain Gmail account there is none — move the clinic to Workspace (Business Starter) before the public launch. |
| Cloudflare (Workers, KV) | the assistant's logic, 24-hour conversation state | Keeps no message bodies beyond 24 h; BAA historically Enterprise-only — not needed for the pilot given what is stored. |
| Anthropic (Claude API) | phrasing the assistant's replies | API data is not used for training; request zero-data-retention on the organisation. Never the consumer app. |
| Meta WhatsApp Business | client channel | **Meta signs no BAA.** End-to-end encrypted in transit; Dr. Bibi decided (1 Nov 2026) that clinical questions and updates may travel over WhatsApp — see §7 for the safeguards. |
| Tap Payments | appointment fees | PCI-DSS is theirs; we store only references and status. Confirm the payout operator (MERCHANT) belongs to the clinic. |

## 5. People & process (the part no code can do)
- Named **privacy officer** (Dr. Bibi) and **security officer** (Sulaiman) — in writing (Privacy & security protocol, v1).
- Staff confidentiality agreements; a 30-minute walkthrough of the protocol for anyone who receives client data; offboarding checklist (remove sharing, rotate secrets, change the front-desk number).
- Incident procedure: 1 h / 24 h / 7 days — who is told, what is rotated, how clients are informed.
- Client-facing: privacy page on tawasol.me (bilingual, draft included); one consent sentence in the intake form naming WhatsApp as the follow-up channel and offering phone contact instead.
- Quarterly: review who has access to the Google account, sheet and calendar; export Inbox and Payments to the clinic's encrypted drive; purge rows past retention.

## 6. Accounts & continuity
Every service under accounts the clinic controls: Google (clinic account), Cloudflare, Anthropic, Meta Business portfolio, Tap, GoDaddy (tawasol.me), GitHub. Sulaiman is an *additional admin*, never the sole owner. Recovery email and phone point to the clinic. A sealed note of where credentials live (password manager) sits with the clinic.

## 7. Decisions taken and open
1. **Taken (1 Nov 2026, Dr. Bibi): clinical questions and updates may travel over WhatsApp.** Safeguards: the client is told WhatsApp is used for follow-up and may ask for a phone call instead; the Inbox sheet, not WhatsApp, is the record of truth; clinic-owned WhatsApp Business number with two-step PIN; team phones locked, no personal-cloud backup of clinic threads; text only — never documents or attachments; revisit if the clinic ever takes US patients.
2. **Taken (12 Nov 2026): roles.** Dr. Bibi = doctor channel (receives the patient-file context); front desk = Sulaiman during the pilot, the coordinator at go-live; the clinic number joins after Meta business verification.
3. **Open:** retention periods (§2) · Workspace migration date (§4) · whether the Patients register moves into the admin dashboard (§3).

## 8. Implemented vs pending
**Implemented:** WhatsApp and website assistant with one-window voice; calendar holds and 6-week availability; Tap payment links with server-side verification; Inbox / Payments / Patients tabs; doctor relay with file context driven by Dr. Bibi's plain-language notes (reply, prescription, follow-up, passcode, file info) with name disambiguation; passcode gate for clinical content from unknown numbers; 24-hour conversation state; team and doctor alerts; privacy page draft; this framework and the signed protocol.
**Pending:** retention purge (one scheduled job once periods are decided); Workspace migration; human-takeover command for the front desk; Patient card in the admin; payment-reminder and follow-up-reminder jobs; clinic number on WhatsApp after Meta verification.
