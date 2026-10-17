# UPayments checkout for the Tawasol book site

The site on GitHub Pages is public files, so the UPayments API key can't live there. This folder is a tiny server
(one Cloudflare Worker, free tier) that holds the key, creates the payment, receives UPayments' confirmation,
issues the access code, and unlocks the ebook/audiobook pages.

```
Buyer → order.html ──POST /checkout──▶ Worker ──/api/v1/charge──▶ UPayments (KNET · Visa · Mastercard · Apple Pay)
                                                                          │
         thanks.html ◀── returnUrl ───────────────────────────────────────┤  buyer comes back
         Worker  ◀────── notificationUrl (webhook, HMAC-signed) ──────────┘  payment confirmed → code issued → email
         ebook.html / audiobook.html ──POST /unlock──▶ Worker (email + code → licence, max 3 devices)
```

## Set up (dashboard only, no terminal) — about 20 minutes

1. **Cloudflare account** → *Workers & Pages* → *Create* → *Create Worker* → name it `tawasol-book-api` → *Deploy*.
2. *Edit code* → delete the sample → paste the whole of `worker.js` → *Deploy*.
3. **KV storage**: *Storage & Databases* → *KV* → *Create* `tawasol-orders`, then again `tawasol-codes`.
4. Back in the Worker → *Settings* → *Bindings* → *Add* → *KV namespace*:
   variable `ORDERS` → `tawasol-orders`; add again: `CODES` → `tawasol-codes`.
5. *Settings* → *Variables and Secrets* → add:
   - `UPAYMENTS_BASE` (text) = `https://sandboxapi.upayments.com`
   - `SITE_URL` (text) = `https://boodai88-lgtm.github.io/tawasol-book`
   - `UPAYMENTS_TOKEN` (**secret**) = sandbox key `NWty8gdjt79cf756hdtyu6u8jht5ns6gfhgy8hdjL`
   - `UPAYMENTS_SECRET` (**secret**) = `sk_test_01a0a4b450b4c4738b586d7f33134d44`
   - `SESSION_SECRET` (**secret**) = any long random text
   - optional `RESEND_API_KEY` (**secret**) + `FROM_EMAIL` (text) to email receipts and access codes ([resend.com](https://resend.com), free tier)
   *Deploy* after saving.
6. Copy the Worker URL (looks like `https://tawasol-book-api.<your-account>.workers.dev`).
7. In the site's `site.js`, set `checkoutApi: "https://tawasol-book-api.<your-account>.workers.dev"` and upload `site.js` to the GitHub repo.

## Test (sandbox)
Open the live order page, choose a format, fill details, *Continue to secure payment* → you land on UPayments' sandbox page.
Pay with a test card from <https://developers.upayments.com/reference/test-cards> (KNET or card; wallets don't work in sandbox).
You return to `thanks.html`; within a few seconds it shows **Paid** and the access code (also emailed if Resend is set).
Then open `ebook.html`, enter the same email + code → the library unlocks.

## Go live
1. Get production credentials: <https://my.upayments.com> → *Payment Gateway* → *Gateway details* (or support@upayments.com / +965 1809888).
2. In the Worker secrets replace `UPAYMENTS_TOKEN` and `UPAYMENTS_SECRET` with the production values.
3. Set `UPAYMENTS_BASE` to the production base URL shown in your dashboard (UPayments' own plugins use `https://apiv2api.upayments.com`).
4. Real prices: edit `PRICES` / `SHIPPING` at the top of `worker.js` **and** `products` / `shipping` in `site.js` — the Worker's table is what gets charged.
5. Put the final site address in `SITE_URL` (your custom domain once you have one).

## What the Worker guarantees
- The amount is computed server-side from `PRICES`; the browser can't change it.
- An order is marked **paid** only by UPayments' signed webhook (`X-Signature`, HMAC-SHA256 over `timestamp + POST + url + body`) or by the Worker itself calling *Get Payment Status*.
- Access codes are `TAWASOL-XXXX-XXXX`, bound to the buyer's email, usable on 3 devices.
- The code is shown on the thanks page only to the browser that came back from UPayments (it must carry the matching `track_id`), and is always emailed.

## Troubleshooting
- *"Payment could not be started (…)"* — the message in brackets is UPayments' validation error. If it mentions `tokens`, add `tokens: {},` to the `payload` in `checkout()`. If it mentions `mobile`, the phone must be `+965XXXXXXXX` with no spaces (the Worker already drops badly formatted numbers).
- *Thanks page stays "Confirming…"* — the webhook could not reach the Worker or the signature failed. Check *Worker → Logs*; confirm `UPAYMENTS_SECRET` matches the key for the same environment (sandbox vs production).
- *CORS error in the browser console* — `SITE_URL` must be exactly the site origin the page is served from.

## Not included yet
Delivery of the actual files: `/unlock` returns a signed `token`; the next step is `/chapter/:n` and `/stream/:n`
endpoints that check that token and return the text / a short-lived signed audio URL from private storage (R2).
Nothing in this repo contains the book or the audio.
