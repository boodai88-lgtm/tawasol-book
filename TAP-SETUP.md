# Tap Payments — setup for Juana (dashboard side)

The assistant creates a Tap payment link for every booking and confirms the appointment only after Tap tells us the money was captured. Juana's part is entirely inside the Tap dashboard; the worker side is four values.

## A. Account
1. Go to **register.tap.company** → *Create account* → country **Kuwait**, business **Tawasol Wellbeing Clinic**, clinic email, phone 66689362.
2. Complete **business activation** (this unlocks live KNET + cards): commercial licence, civil ID of the owner (Dr. Bibi), IBAN letter from the clinic's bank, website URL (the hub). Tap usually activates in 2–5 working days; **test mode works immediately**, so steps B–D don't wait for this.
3. Settings → **Team** → invite Sulaiman (Admin) and Dr. Bibi (Admin). Turn on two-factor for every member (Settings → Security).

## B. Keys (dashboard → goSell → **API Credentials**)
There are two pairs. We only ever use the **Secret** key, never the publishable one.
- **Test**: `sk_test_…` — copy this first.
- **Live**: `sk_live_…` — only after activation, and only when we switch.
Give the test key to Sulaiman through a password manager or in person — **never in WhatsApp or email**. Anyone with the secret key can create and refund charges.

## C. Webhook & redirect (dashboard → goSell → **Settings → Webhook / Redirect**)
Our worker passes both URLs on every charge, so nothing is strictly required here — but set them anyway as the fallback:
- **Post (webhook) URL**: `https://aged-mud-dbb7.boodai88.workers.dev/api/assistant/pay/webhook`
- **Redirect URL**: `https://<hub site>/pay-return.html`
Leave *hashstring* verification **on** (default) — the worker checks it, and always re-fetches the charge from Tap before confirming anything.

## D. Payment methods (dashboard → **Payment methods**)
Enable **KNET** and **Visa/Mastercard** (3-D Secure on). Apple Pay / Google Pay are optional and need the domain registered with Tap. Currency **KWD** only.

## E. Worker side (Sulaiman, 2 minutes)
Cloudflare → worker **aged-mud-dbb7** → *Settings → Variables and Secrets*:
| Name | Type | Value |
|---|---|---|
| `TAP_SECRET_KEY` | Secret | `sk_test_…` now, `sk_live_…` at go-live |
| `PAY_HOURS` | Variable | `24` (how long a payment link / calendar hold lives) |
Deploy. `GET /` on the worker should now show `"payments": "tap-test"`.

## F. Test it (test mode, no real money)
1. On the clinic page book a follow-up for tomorrow → the assistant sends a Tap link.
2. Pay with Tap's test card **4508 7500 1574 1019**, any future expiry, CVV 100 (KNET test: pick any bank, use the test credentials shown on the page).
3. Expect, within ~10 s: confirmation message in the chat, the calendar HOLD renamed to the client's name, a row *paid* in the Payments sheet tab, a WhatsApp alert on 66689362 (once WhatsApp is live).
4. Try a **declined** card (**4000 0000 0000 0002**): the hold must stay a HOLD and the chat must say the payment didn't go through.
5. Dashboard → *Transactions*: both attempts appear; click one → *Webhook logs* should show `200` from our URL.

## G. Go-live switch (after activation)
1. Replace `TAP_SECRET_KEY` with `sk_live_…` → deploy.
2. Make one real KD 1 charge with a staff card, then **refund it from the dashboard** (Transactions → Refund) — that is also how refunds are done later: the dashboard, not the assistant.
3. Settlement: KNET pays out next working day, cards T+2 to the IBAN on file. Fees are shown per transaction under *Transactions*; download the monthly statement from *Reports* for the accountant.

## Who does what
- **Juana**: A, B (copies keys), C, D, G.2 refunds, monthly report.
- **Sulaiman**: E, F, G.1.
- **Dr. Bibi**: approves activation documents; nothing else.

Never put the secret key in the website files or the GitHub package.
