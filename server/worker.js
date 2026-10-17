/* Tawasol book — checkout + licence server for UPayments (Cloudflare Worker).
   Routes:  POST /checkout   create order → UPayments charge → returns payment link
            POST /webhook    UPayments notificationUrl (HMAC-verified) → marks order paid, issues access code, emails buyer
            GET  /status     ?order=TW-…&track=…  → order status (thanks page polls this; reconciles with UPayments if webhook is late)
            POST /unlock     {email, code, device} → licence session for the ebook / audiobook pages
   Bindings: KV ORDERS, KV CODES. Vars: UPAYMENTS_BASE, SITE_URL, FROM_EMAIL.
   Secrets:  UPAYMENTS_TOKEN, UPAYMENTS_SECRET, SESSION_SECRET, RESEND_API_KEY (optional). */

const PRICES = { print: 20.000, ebook: 10.000, audiobook: 15.000 };          // keep in sync with site.js
const SHIPPING = { kw: 2.000, gcc: 6.000, intl: 12.000 };
const TITLES = { print: "Tawasol, The Guidebook — printed book", ebook: "Tawasol, The Guidebook — ebook", audiobook: "Tawasol, The Guidebook — audiobook" };
const MAX_DEVICES = 3;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const cors = corsHeaders(env);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      if (url.pathname === "/checkout" && req.method === "POST") return json(await checkout(await req.json(), env, url), 200, cors);
      if (url.pathname === "/webhook" && req.method === "POST") return webhook(req, env, ctx, url);
      if (url.pathname === "/status" && req.method === "GET") return json(await status(url.searchParams, env, ctx), 200, cors);
      if (url.pathname === "/unlock" && req.method === "POST") return json(await unlock(await req.json(), env), 200, cors);
      return json({ error: "Not found" }, 404, cors);
    } catch (e) {
      return json({ error: e.message || "Server error" }, e.status || 500, cors);
    }
  },
};

/* ---------- checkout ---------- */
async function checkout(body, env, url) {
  const items = {}, products = []; let amount = 0;
  for (const k of ["print", "ebook", "audiobook"]) {
    const q = k === "print" ? Math.min(20, Math.max(0, parseInt(body.items?.[k]) || 0)) : (body.items?.[k] ? 1 : 0);
    if (!q) continue;
    items[k] = q; amount += PRICES[k] * q;
    products.push({ name: TITLES[k], description: TITLES[k], price: PRICES[k], quantity: q });
  }
  if (!Object.keys(items).length) throw err(400, "Choose at least one format.");
  const ship = items.print ? (SHIPPING[body.ship] !== undefined ? body.ship : "kw") : null;
  if (ship) { amount += SHIPPING[ship]; products.push({ name: "Delivery", description: "Delivery — " + ship.toUpperCase(), price: SHIPPING[ship], quantity: 1 }); }
  amount = +amount.toFixed(3);

  const c = body.customer || {};
  const email = String(c.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err(400, "A valid email is required.");
  const phone = String(c.phone || "").replace(/[^\d+]/g, "");
  const id = "TW-" + Date.now().toString(36).toUpperCase() + rand(3);
  const order = {
    id, items, ship, amount, currency: "KWD", status: "pending", created: new Date().toISOString(),
    digital: !!(items.ebook || items.audiobook),
    customer: { name: String(c.name || "").slice(0, 50), email, phone },
    address: items.print ? { line: String(body.address?.line || "").slice(0, 200), city: String(body.address?.city || "").slice(0, 80), country: String(body.address?.country || "").slice(0, 80) } : null,
  };

  const payload = {
    products,
    order: { id, reference: id, description: "Tawasol, The Guidebook — order " + id, currency: "KWD", amount },
    language: body.lang === "ar" ? "ar" : "en",
    reference: { id },
    customer: { uniqueId: email, name: order.customer.name || "Reader", email, ...(/^\+\d{8,15}$/.test(phone) ? { mobile: phone } : {}) },
    returnUrl: env.SITE_URL + "/thanks.html",
    cancelUrl: env.SITE_URL + "/order.html?cancelled=1",
    notificationUrl: url.origin + "/webhook",
    paymentLinkExpiryInMinutes: 60,
  };
  const r = await fetch(env.UPAYMENTS_BASE + "/api/v1/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + env.UPAYMENTS_TOKEN },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  const link = j?.data?.link || j?.data?.url || j?.link;
  if (!r.ok || !link) throw err(502, "Payment could not be started (" + (j?.message || r.status) + ").");
  order.trackId = j?.data?.trackId || j?.data?.track_id || null;
  order.sessionId = j?.data?.sessionId || j?.data?.session_id || null;
  await env.ORDERS.put(id, JSON.stringify(order), { expirationTtl: 60 * 60 * 24 * 730 });
  if (order.trackId) await env.ORDERS.put("track:" + order.trackId, id, { expirationTtl: 60 * 60 * 24 * 730 });
  return { orderId: id, amount, link };
}

/* ---------- webhook (UPayments → us) ---------- */
async function webhook(req, env, ctx, url) {
  const raw = await req.text();
  if (env.UPAYMENTS_SECRET) {
    const ts = req.headers.get("X-Timestamp") || "", sig = req.headers.get("X-Signature") || "";
    const expected = await hmacB64(env.UPAYMENTS_SECRET, ts + "POST" + url.origin + url.pathname + raw);
    if (!safeEqual(expected, sig)) return new Response("invalid signature", { status: 401 });
  }
  let data; try { data = JSON.parse(raw); } catch (_) { data = Object.fromEntries(new URLSearchParams(raw)); }
  const f = flatten(data);
  let id = f.requested_order_id || f.requestedOrderId || f.reference_id || f.referenceId;
  if (!id && f.track_id) id = await env.ORDERS.get("track:" + f.track_id);
  const order = id ? await getOrder(id, env) : null;
  if (!order) return new Response("order not found", { status: 404 });
  const result = String(f.result || f.status || "").toUpperCase();
  if (result === "CAPTURED") await markPaid(order, f, env, ctx);
  else if (order.status === "pending" && result) { order.lastResult = result; await env.ORDERS.put(order.id, JSON.stringify(order)); }
  return new Response("ok", { status: 200 });
}

/* ---------- status (thanks page) ---------- */
async function status(params, env, ctx) {
  const order = await getOrder(params.get("order"), env);
  if (!order) throw err(404, "Order not found.");
  if (order.status === "pending" && order.trackId) {               // reconcile in case the webhook hasn't arrived yet
    const r = await fetch(env.UPAYMENTS_BASE + "/api/v1/get-payment-status/" + order.trackId, { headers: { Accept: "application/json", Authorization: "Bearer " + env.UPAYMENTS_TOKEN } }).catch(() => null);
    const j = r && (await r.json().catch(() => null));
    if (j && hasValue(j, "CAPTURED")) await markPaid(order, flatten(j), env, ctx);
  }
  const revealCode = order.status === "paid" && order.digital && order.trackId && params.get("track") === order.trackId;
  return { order: order.id, status: order.status, digital: order.digital, items: order.items, amount: order.amount, email: maskEmail(order.customer.email), code: revealCode ? order.code : undefined };
}

async function markPaid(order, f, env, ctx) {
  if (order.status === "paid") return order;
  order.status = "paid"; order.paid = new Date().toISOString();
  order.payment = { track_id: f.track_id, payment_id: f.payment_id, tran_id: f.tran_id, ref: f.ref, payment_type: f.payment_type, receipt_id: f.receipt_id };
  if (order.digital && !order.code) { order.code = await newCode(env); await env.CODES.put(order.code, order.id); }
  await env.ORDERS.put(order.id, JSON.stringify(order));
  ctx.waitUntil(sendReceipt(order, env));
  return order;
}

/* ---------- unlock (ebook / audiobook gate) ---------- */
async function unlock(body, env) {
  const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const email = String(body.email || "").trim().toLowerCase();
  const id = code && (await env.CODES.get(code));
  const order = id ? await getOrder(id, env) : null;
  if (!order || order.status !== "paid" || order.customer.email !== email) throw err(401, "We couldn't match that email and code.");
  const device = String(body.device || "").slice(0, 40) || rand(12);
  order.devices = order.devices || [];
  if (!order.devices.includes(device)) {
    if (order.devices.length >= MAX_DEVICES) throw err(403, "This code is already active on " + MAX_DEVICES + " devices. Write to us to reset it.");
    order.devices.push(device); await env.ORDERS.put(order.id, JSON.stringify(order));
  }
  const token = await hmacB64(env.SESSION_SECRET || env.UPAYMENTS_SECRET || "tawasol", order.id + ":" + device);
  return { ok: true, order: order.id, email, items: order.items, device, token };
}

/* ---------- email ---------- */
async function sendReceipt(order, env) {
  if (!env.RESEND_API_KEY) return;
  const lines = Object.entries(order.items).map(([k, q]) => `<li>${TITLES[k]}${q > 1 ? " × " + q : ""}</li>`).join("");
  const digital = order.digital ? `<p style="margin:22px 0 6px">Your personal access code for the ebook and audiobook library:</p><p style="font:600 22px/1.2 Helvetica,Arial,sans-serif;letter-spacing:.12em;background:#f6f1e6;display:inline-block;padding:12px 18px;border-radius:8px">${order.code}</p><p>Open <a href="${env.SITE_URL}/ebook.html">${env.SITE_URL}/ebook.html</a> or <a href="${env.SITE_URL}/audiobook.html">…/audiobook.html</a>, enter this email and the code.<br>The copy is licensed to you personally, works on up to ${MAX_DEVICES} devices, and may not be shared without written consent from Tawasol.</p>` : "";
  const html = `<div style="font:16px/1.6 Helvetica,Arial,sans-serif;color:#2b2926;max-width:560px;margin:auto;padding:24px"><p style="font-size:22px;margin:0 0 4px">Thank you — order ${order.id}</p><p style="color:#6b665c;margin:0 0 18px">Tawasol, The Guidebook · KD ${order.amount.toFixed(3)} paid</p><ul>${lines}</ul>${digital}${order.items.print ? "<p>Your printed book ships within 5 working days.</p>" : ""}<p style="color:#8b857a;font-size:13px;margin-top:28px">Tawasol · Dr. Bibi Alamiri</p></div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.RESEND_API_KEY },
    body: JSON.stringify({ from: env.FROM_EMAIL || "Tawasol <onboarding@resend.dev>", to: [order.customer.email], subject: "Your Tawasol order " + order.id, html }),
  }).catch(() => {});
}

/* ---------- helpers ---------- */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function rand(n) { const a = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const b of a) s += ALPHA[b % ALPHA.length]; return s; }
async function newCode(env) { for (let i = 0; i < 5; i++) { const c = "TAWASOL-" + rand(4) + "-" + rand(4); if (!(await env.CODES.get(c))) return c; } throw err(500, "Could not issue a code."); }
async function getOrder(id, env) { if (!id) return null; const s = await env.ORDERS.get(String(id)); return s ? JSON.parse(s) : null; }
async function hmacB64(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
function safeEqual(a, b) { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function flatten(o, out = {}) { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object") flatten(v, out); else if (out[k] === undefined) out[k] = v; } return out; }
function hasValue(o, v) { if (o === v) return true; if (o && typeof o === "object") return Object.values(o).some((x) => hasValue(x, v)); return false; }
function maskEmail(e) { const [u, d] = e.split("@"); return u[0] + "***@" + d; }
function err(status, message) { const e = new Error(message); e.status = status; return e; }
function corsHeaders(env) { return { "Access-Control-Allow-Origin": env.SITE_URL ? new URL(env.SITE_URL).origin : "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" }; }
function json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } }); }
