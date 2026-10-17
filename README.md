# Tawasol — Book site

A static, GitHub-Pages-ready site for *Tawasol, The Guidebook*: home, order page, licensed ebook library and audiobook player. Plain HTML/CSS/JS — no build step, no framework. **Mobile-first**: styles are written for phones, then widened at 720px (tablet) and 1000px (desktop).

```
book-site/
  index.html       The book (hero, formats, three methods, licence promise)
  order.html       Formats → delivery → details → secure checkout hand-off
  ebook.html       Access gate → watermarked web reader + licensed downloads
  audiobook.html   Access gate → streaming player with chapters
  site.css         Page styles (imports tokens.css)
  tokens.css       Copy of the Tawasol design tokens + Google Fonts
  site.js          Config (prices, links) + page behaviour
  img/             Wordmark, line-art illustrations
```

## Publish on GitHub Pages
1. Create a repo (e.g. `tawasol-book`) and push the contents of this folder to its root.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / root.
3. Optional: add a `CNAME` file with your domain (e.g. `book.tawasol.clinic`) and point DNS at GitHub.

## Configure
Everything editable is at the top of `site.js` (`window.TAWASOL_SITE`): prices (placeholders — set the real ones), shipping, `paymentLink`, `licenseApi`, chapter titles, and the approved preview text. Replace the CSS "book" object in `index.html` with `<img src="img/cover.jpg">` when the final cover is ready.

## How purchase + protection work (what the static site can and cannot do)
A GitHub Pages site is public files; it cannot keep a secret or hold the book. Protection comes from three small services around it:

**1. Payments** — a hosted checkout link (Tap Payments or MyFatoorah for KNET + cards in Kuwait; Stripe Payment Links internationally). Set it as `paymentLink`. No card data ever touches the site.

**2. Licence server** (one serverless function, e.g. Cloudflare Worker + KV, or Vercel + a small DB)
- Payment webhook → creates the order, generates a personal access code, emails it (Resend/Postmark).
- `POST /unlock` — email + code → short-lived session token (this replaces the `demoCode` check in `site.js`; set `licenseApi`).
- Limits: 3 active devices per licence, codes revocable, every download/stream logged against the order.

**3. The files themselves never live in the repo.** Keep them in private object storage (Cloudflare R2 / S3) and only ever hand out short-lived signed URLs from the licence server.

### Ebook
- *Web reader:* text is fetched chapter-by-chapter with the session token; the visible and invisible watermark ("Licensed to name · order") is rendered per reader; copy/print/right-click are disabled as a deterrent.
- *Download:* a PDF generated **per buyer** at download time, with the buyer's name, email and order number on every page plus invisible metadata (social DRM), delivered through a 15-minute signed URL with a download cap. Leaked copies are traceable to an order.
- *If hard DRM is required:* Readium LCP or Adobe DRM via a provider (EditionGuard, Vitrium). Stronger, but readers need a compatible app — more support load. Recommended only if non-negotiable.

### Audiobook
- Stream-only by default: HLS with AES-128 encryption; keys and segment URLs are signed per session and expire. Cloudflare Stream, Bunny Stream or Mux all do this out of the box.
- Optional per-order forensic audio watermark (inaudible) if downloads are offered.
- Offline listening requires an app (PWA with encrypted cache, or native); the site shows the promise but the implementation lives in the licence server + service worker.

### Honest limits
No system prevents photographing a screen or recording from a speaker. Watermarking + per-person licensing + the consent clause the buyer accepts at checkout is the practical protection, and it is what the site communicates.

## Demo mode
With `licenseApi` empty, the gate accepts `TAWASOL-DEMO`, the reader shows the approved opening credits + Introduction, and the player simulates playback. Nothing is stored except a `tawasol_license` entry in the browser's localStorage.

## Brand
Built on the Tawasol design tokens (cream paper, sage/mauve/rose accents, warm-charcoal ink; Sacramento / Jost / Mulish). Only approved artwork and credits are used; copy on the home page reuses approved manuscript sentences.
