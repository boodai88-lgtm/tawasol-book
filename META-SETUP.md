# Tawasol assistant on WhatsApp — Meta setup (step by step)

Goal: the same assistant that runs on the website answers the clinic WhatsApp **+965 6668 9362**. First on Meta's free **test number**, then on the real number after **business verification**.

## 0. What you need before starting
- A personal Facebook account for Sulaiman (Meta requires one to administer a Business Portfolio).
- Clinic documents for verification: commercial licence / registration, a utility or phone bill or bank statement showing the **business name and address**, and a business website or official page (the hub URL works once it is on a domain you own).
- The clinic phone **66689362** must be able to receive an SMS or call **and must not be registered on the WhatsApp app** at the moment you add it (Meta moves the number from the app to the API; chats on the phone stop — back them up first, or use a second SIM for the API).
- The hub API deployed (Cloudflare Worker) so the webhook URL exists: `https://<api>/api/assistant/webhook/meta`.

## 1. Meta Business Portfolio (business.facebook.com)
1. Create a portfolio: **Tawasol Wellbeing Clinic**, Kuwait, the clinic email.
2. Settings → **Business info**: legal name exactly as on the licence, address (MEDC2 Complex, Sabah Al Salem, Block 1, Street 106, 7th floor), phone 66689362, website.
3. Settings → **People**: add Dr. Bibi as Admin, Sulaiman as Admin.
4. Settings → **Security Centre**: turn on two-factor for every admin (Meta requires it for verification).

## 2. Developer app (developers.facebook.com)
1. **My Apps → Create App** → use case **Other** → type **Business** → name `Tawasol Assistant` → attach the Business Portfolio.
2. **Add product → WhatsApp → Set up**. Meta creates a *WhatsApp Business Account (WABA)* and gives you a **test phone number** with a temporary token.
3. On *API Setup*: note **Phone number ID**, **WABA ID**. Add Sulaiman's and Dr. Bibi's personal numbers under **To** (max 5 test recipients) and send the hello_world template — if it arrives, the test number works.

## 3. Connect the assistant (test phase)
1. Cloudflare → the hub API worker → *Settings → Variables and Secrets*:
   - `WHATSAPP_TOKEN` — for now the temporary token from API Setup (24 h). For a permanent one: Business Settings → **System users** → add `tawasol-bot` (Admin) → *Generate token* → app `Tawasol Assistant`, permissions **whatsapp_business_messaging**, **whatsapp_business_management**, never expires.
   - `WHATSAPP_PHONE_ID` — the Phone number ID from step 2.3.
   - `META_APP_SECRET` — App → *App settings → Basic → App secret* (used to verify webhook signatures).
   - `META_VERIFY_TOKEN` — any long random string you invent (e.g. 32 letters).
   - `ANTHROPIC_API_KEY` — same key the website assistant uses.
2. App → WhatsApp → **Configuration → Webhook → Edit**: Callback URL `https://<api>/api/assistant/webhook/meta`, Verify token = your `META_VERIFY_TOKEN` → *Verify and save*. Then **Manage** → subscribe to **messages**.
3. Admin → Settings → *Team WhatsApp* = 96566689362 (already the default) so alerts go to the clinic phone.
4. Test: from a test-recipient phone, WhatsApp the test number: "I want to book". The assistant should reply within a few seconds; the booking should appear in Admin → Inbox and an alert on 66689362.

## 4. Business verification (needed for the real number and for more than 250 conversations/day)
1. Business Settings → **Security Centre → Start verification**.
2. Choose the legal business name → upload the licence → confirm address with the bill/bank statement → confirm by phone/email/domain. Typical turnaround: 2–10 working days. Use the exact same name/address spelling everywhere.
3. Meanwhile: App → *App Review → Permissions and features*: request **Advanced access** for `whatsapp_business_messaging` and `whatsapp_business_management` (needs a short screen recording of the chat flow — I can supply a script for it).

## 5. Move to the real clinic number
1. WhatsApp Manager → *Phone numbers → Add phone number*: display name **Tawasol Clinic** (Meta checks it matches the business), category *Medical & Health*, description, address, hours, website, profile photo = `img/mark.png` (the pink brain).
2. Enter **+965 66689362** → verify by SMS or voice call. (Remove the number from the WhatsApp Business app first — same number can't be in both.)
3. Set the new **Phone number ID** in `WHATSAPP_PHONE_ID`; redeploy. Team alerts should go to a *different* staff phone now (Admin → Settings → Team WhatsApp), otherwise the bot messages itself.
4. **Two-step verification** for the number (WhatsApp Manager → Settings) — required.
5. Register message **templates** (Business messages after the 24-hour window must use them): `appointment_confirmed` (EN/AR), `appointment_reminder` (EN/AR), `payment_received`. Text = the clinic's current scripts (fees, confirmation with day/date/time, location + map). Approval usually within hours.
6. Display-name approval and the official green tick (Meta Verified) are optional and separate.

## 6. Instagram (after WhatsApp is stable)
Instagram must be a **Professional** account linked to a Facebook Page owned by the portfolio. App → *Add product → Instagram* → Messaging → same webhook URL, subscribe `messages` → request `instagram_manage_messages` in App Review. The hub webhook already handles both.

## 7. Compliance reminders
Meta signs no BAA; clinical content over WhatsApp is Dr. Bibi's documented decision (COMPLIANCE.md §7). Keep: clinic-owned number, two-step verification on, admins with 2FA, no personal-cloud backups of the business account, and the hub inbox as the record of truth. Payment of the WABA (conversation fees in KWD-equivalent, service conversations free within 24 h of a client message) via a card added under Business Settings → Payments.

## Checklist — what I need from you
- [ ] Facebook login with admin rights on the new portfolio (or add me as an *Employee* with Developer access)
- [ ] Clinic licence + proof-of-address document scans
- [ ] Which phone receives team alerts once the bot owns 66689362
- [ ] Confirmation that the number can leave the WhatsApp app (backup done)
- [ ] Deployed hub API URL (for the webhook)
