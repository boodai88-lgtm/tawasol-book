# WhatsApp test number for the Tawasol assistant — click by click

You are on **developers.facebook.com → Create an app**. Nothing here needs business verification; the test number works today and messages up to 5 phones you choose.

## 1. Create the app (the screen in front of you)
1. **App name**: `Tawasol Assistant` · contact email: boodai88@gmail.com → **Next**.
2. **Use cases**: tick **"Other"** (if shown) or scroll to **"Connect with customers through WhatsApp"** → Next.
3. **Business**: choose the **Tawasol Wellbeing Clinic** portfolio. If the dropdown is empty: *Create a business portfolio* → name `Tawasol Wellbeing Clinic`, Kuwait, your email → it appears → select it → Next.
4. **Requirements**: nothing to add → Next → **Overview** → **Create app** (re-enter Facebook password if asked).

## 2. Add WhatsApp
1. On the app dashboard, under *Add products to your app*, find **WhatsApp → Set up**.
2. Meta creates a *WhatsApp Business Account* for the portfolio and opens **WhatsApp → API Setup**.

## 3. Get the three values (API Setup page)
Write these down — they go into the worker:
- **Temporary access token** (top; valid 24 h — fine for today).
- **Phone number ID** (under *From*, below the test number `+1 555 …`).
- **WhatsApp Business Account ID** (next to it).

## 4. Add your test phones
Still on API Setup → **To** → *Manage phone number list* → add Sulaiman's and Dr. Bibi's personal WhatsApp numbers with +965 → each receives a 6-digit code on WhatsApp → enter it. Max 5 numbers.

## 5. Send the hello message
Step 2 on that page: **Send message** → the `hello_world` template arrives on your phone. If it does, the number works.

## 6. Connect the worker (Cloudflare → worker *aged-mud-dbb7* → Settings → Variables and Secrets)
| Name | Type | Value |
|---|---|---|
| `WHATSAPP_TOKEN` | Secret | the temporary token (replace with the permanent one in step 9) |
| `WHATSAPP_PHONE_ID` | Variable | Phone number ID from step 3 |
| `META_VERIFY_TOKEN` | Secret | invent a long random string, e.g. `tawasol-7f3k9…` (32+ characters) — keep it, you need it in step 7 |
| `META_APP_SECRET` | Secret | app → *App settings → Basic → App secret → Show* |
| `TEAM_WHATSAPP` | Variable | the number that should receive team alerts **during testing** — use Sulaiman's own number for now (one of the 5 test phones), not 66689362 |
Deploy.

## 7. Webhook
App → **WhatsApp → Configuration** → *Webhook* → **Edit**:
- Callback URL: `https://aged-mud-dbb7.boodai88.workers.dev/api/assistant/webhook/meta`
- Verify token: the exact `META_VERIFY_TOKEN` string → **Verify and save** (green tick; a red error means the token differs or the worker isn't deployed).
- Then **Manage** → subscribe **messages** (tick) → Done.

## 8. First real test
From one of the 5 test phones, WhatsApp the test number (`+1 555 …` shown on API Setup — save it as a contact "Tawasol test"): send **"hi"**. Expect the assistant's greeting with the language choice within seconds. Then try "I want to book a follow-up" and go through to the payment link. Dr. Bibi's number (DOCTOR_WHATSAPP) gets the doctor-message relays; TEAM_WHATSAPP gets alerts.

If nothing comes back: Cloudflare → worker → *Logs → Begin log stream*, send "hi" again, read the error. The usual two: token expired (24 h — do step 9) or the webhook wasn't subscribed to *messages*.

## 9. Permanent token (do this before the day ends)
business.facebook.com → **Settings → Users → System users → Add**: name `tawasol-bot`, role **Admin** → *Add assets* → **Apps → Tawasol Assistant → Full control** → **Generate new token**: app *Tawasol Assistant*, expiry **Never**, permissions **whatsapp_business_messaging** + **whatsapp_business_management** → copy → replace `WHATSAPP_TOKEN` → deploy.

## 10. What the test number cannot do
- Message only the 5 registered phones; no clients yet.
- No custom display name or profile photo.
- Moving to **66689362** needs business verification (META-SETUP.md §4–5) and the number removed from the WhatsApp app first.

Done = step 8 works twice in a row in English and Arabic. Then tell me and I'll do the first supervised run with Dr. Bibi.
