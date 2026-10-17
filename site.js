/* Tawasol book site — configuration + page behaviour. No build step. */
window.TAWASOL_SITE = {
  currency: "KD",
  // Hosted checkout link (Tap Payments / MyFatoorah / Stripe Payment Link). Empty = demo confirmation only.
  paymentLink: "",
  // Base URL of the licence server that issues access codes + signed media URLs. Empty = demo mode.
  licenseApi: "",
  demoCode: "TAWASOL-DEMO",
  products: {
    print:     { title: "Printed book", sub: "Bilingual edition — English and Arabic meet in the middle", price: 15.000 },
    ebook:     { title: "Ebook", sub: "English & Arabic editions · read online or download your licensed copy", price: 7.000 },
    audiobook: { title: "Audiobook", sub: "English · written and narrated by Dr. Bibi Alamiri", price: 9.000 },
  },
  shipping: { kw: { label: "Kuwait", price: 2.000 }, gcc: { label: "GCC", price: 6.000 }, intl: { label: "International", price: 12.000 } },
  chapters: ["Opening credits","Acknowledgment","Introduction","The Methods","Method I: Tawasol Model","Method II: Self-value Tree","Method III: The Boundaries Castle","Summaries","About The Book"],
  // Approved text used by the preview reader (opening credits + the first lines of the Introduction).
  preview: {
    0: { kind: "credits", lines: ["Tawasol, The Guidebook.","Written and narrated by Dr. Bibi Alamiri.","With Sulaiman Boodai.","Illustrations by Marah Alkazak."] },
    2: { kind: "text", paras: [
      "“Tawasol” is the Arabic word for connectedness.",
      "This guide is intended for parents, adolescents, or adults who are invested in deepening their understanding of themselves as a reflection of their upbringing and present circumstances to shape the future.",
      "One of the biggest myths about parenting is that you either make or break your child. This amplified view of a parent’s role in their child’s life is neither accurate nor fair to the child, the parent, or God. A parent is merely a vessel that carries their children to a specific destination. They don’t choose the destination or the route. A parent’s responsibility is to attempt to keep the journey safe, along the way."
    ] },
  },
};

(function () {
  const S = window.TAWASOL_SITE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n) => S.currency + " " + n.toFixed(3);
  const LS_KEY = "tawasol_license";

  // Mobile menu
  const nav = $(".nav"), mb = $("[data-menu]");
  if (mb) mb.addEventListener("click", () => { const open = nav.classList.toggle("open"); mb.setAttribute("aria-expanded", open); mb.firstElementChild.style.setProperty("--i", `url(https://unpkg.com/lucide-static@0.451.0/icons/${open ? "x" : "menu"}.svg)`); });

  // Active nav link + prices printed from config
  const page = document.body.dataset.page;
  $$(".links a[data-p]").forEach((a) => { if (a.dataset.p === page) a.classList.add("on"); });
  $$("[data-price]").forEach((el) => { el.firstChild.nodeValue = fmt(S.products[el.dataset.price].price) + " "; });

  /* ---------------- Order page ---------------- */
  const form = $("#orderForm");
  if (form) {
    const st = { print: false, ebook: false, audiobook: false, qty: 1, ship: "kw" };
    const pre = new URLSearchParams(location.search).get("f");
    if (pre && st.hasOwnProperty(pre)) st[pre] = true;
    const opts = $$(".opt", form);
    const paint = () => {
      opts.forEach((o) => { const k = o.dataset.k; o.classList.toggle("on", st[k]); $("input", o).checked = st[k]; });
      $("#qtyRow").hidden = !st.print; $("#qtyVal").textContent = st.qty;
      $("#delivery").hidden = !st.print;
      $$("#delivery [data-req]").forEach((i) => { i.required = st.print; });
      const lines = $("#sumLines"); lines.innerHTML = "";
      let total = 0, any = false;
      ["print", "ebook", "audiobook"].forEach((k) => {
        if (!st[k]) return; any = true;
        const q = k === "print" ? st.qty : 1, amt = S.products[k].price * q; total += amt;
        lines.insertAdjacentHTML("beforeend", `<div class="ln"><span>${S.products[k].title}${q > 1 ? " × " + q : ""}</span><span>${fmt(amt)}</span></div>`);
      });
      if (st.print) { const sh = S.shipping[st.ship].price; total += sh; lines.insertAdjacentHTML("beforeend", `<div class="ln"><span>Delivery · ${S.shipping[st.ship].label}</span><span>${fmt(sh)}</span></div>`); }
      $("#sumEmpty").hidden = any; $("#sumTotal").hidden = !any; $("#sumTotalVal").textContent = fmt(total);
      $("#payBtn").classList.toggle("is-off", !any);
    };
    opts.forEach((o) => o.addEventListener("click", (e) => { if (e.target.closest(".qty") || e.target.tagName === "INPUT") return; e.preventDefault(); st[o.dataset.k] = !st[o.dataset.k]; paint(); }));
    opts.forEach((o) => $("input", o).addEventListener("change", (e) => { st[o.dataset.k] = e.target.checked; paint(); }));
    $("#qtyMinus").addEventListener("click", () => { st.qty = Math.max(1, st.qty - 1); paint(); });
    $("#qtyPlus").addEventListener("click", () => { st.qty = Math.min(20, st.qty + 1); paint(); });
    $("#ship").addEventListener("change", (e) => { st.ship = e.target.value; paint(); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const order = "TW-" + (10400 + Math.floor(Math.random() * 500));
      $("#orderNo").textContent = order; $("#orderEmail").textContent = $("#email").value;
      $("#orderDigital").hidden = !(st.ebook || st.audiobook);
      form.hidden = true; $("#orderDone").hidden = false; window.scrollTo({ top: 0 });
      if (S.paymentLink) window.open(S.paymentLink, "_blank", "noopener");
    });
    paint();
  }

  /* ---------------- Access gate (ebook / audiobook) ---------------- */
  const gate = $("#gate");
  if (gate) {
    const lib = $("#library");
    const read = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (_) { return null; } };
    const render = () => {
      const lic = read();
      gate.hidden = !!lic; lib.hidden = !lic;
      if (!lic) return;
      $$("[data-lic-email]").forEach((el) => { el.textContent = lic.email; });
      $$("[data-lic-order]").forEach((el) => { el.textContent = lic.order; });
      const r = $(".reader"); if (r) r.dataset.wm = "Licensed to " + lic.email + " · " + lic.order;
    };
    $("#gateForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#gEmail").value.trim(), code = $("#gCode").value.trim().toUpperCase();
      if (code === S.demoCode) { localStorage.setItem(LS_KEY, JSON.stringify({ email, order: "TW-10421", issued: new Date().toISOString() })); $("#gErr").hidden = true; render(); }
      else { $("#gErr").hidden = false; }
    });
    $$("[data-signout]").forEach((b) => b.addEventListener("click", () => { localStorage.removeItem(LS_KEY); render(); }));
    render();
  }

  /* ---------------- Chapter list (shared) ---------------- */
  const tocs = $$(".toc[data-chapters]");
  tocs.forEach((toc) => {
    toc.innerHTML = S.chapters.map((c, i) => `<li data-i="${i}"><i>${String(i + 1).padStart(2, "0")}</i><span>${c}</span></li>`).join("");
  });

  /* ---------------- Reader ---------------- */
  const body = $("#readerBody");
  if (body) {
    const toc = $(".toc[data-chapters]");
    const show = (i) => {
      $$("li", toc).forEach((li) => li.classList.toggle("on", +li.dataset.i === i));
      const p = S.preview[i]; let html = `<h2>${S.chapters[i]}</h2>`;
      if (p && p.kind === "credits") html += `<div class="cred">${p.lines.join("<br>")}</div>`;
      else if (p) html += p.paras.map((t) => `<p>${t}</p>`).join("");
      else html += `<p class="muted">In production this chapter is delivered from the licence server to your signed-in session. This preview includes the opening credits and the start of the Introduction.</p>`;
      body.innerHTML = html; $("#rdTitle").textContent = S.chapters[i];
    };
    toc.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) show(+li.dataset.i); });
    body.addEventListener("contextmenu", (e) => e.preventDefault());
    show(2);
  }

  /* ---------------- Audiobook player ---------------- */
  const player = $("#player");
  if (player) {
    const audio = $("#audio"), toc = $(".toc[data-chapters]");
    let cur = 2, playing = false, t = 0, timer = null;
    const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    const paintT = () => {
      const dur = audio.duration && isFinite(audio.duration) ? audio.duration : 0;
      $("#tCur").textContent = mmss(t); $("#tDur").textContent = dur ? mmss(dur) : "––:––";
      $("#barFill").style.width = (dur ? Math.min(100, t / dur * 100) : Math.min(100, t / 3)) + "%";
    };
    const load = (i) => {
      cur = i; t = 0; $$("li", toc).forEach((li) => li.classList.toggle("on", +li.dataset.i === i));
      $("#npTitle").textContent = S.chapters[i]; $("#npSub").textContent = "Chapter " + (i + 1) + " of " + S.chapters.length;
      if (S.licenseApi) audio.src = S.licenseApi + "/stream/" + (i + 1); // signed URL issued per session
      paintT();
    };
    const setPlay = (on) => {
      playing = on; $("#playIco").style.setProperty("--i", `url(https://unpkg.com/lucide-static@0.451.0/icons/${on ? "pause" : "play"}.svg)`);
      clearInterval(timer);
      if (audio.src) { on ? audio.play() : audio.pause(); return; }
      if (on) timer = setInterval(() => { t += 1; paintT(); }, 1000); // demo: simulated playback
    };
    audio.addEventListener("timeupdate", () => { t = audio.currentTime; paintT(); });
    audio.addEventListener("ended", () => { if (cur < S.chapters.length - 1) { load(cur + 1); setPlay(true); } else setPlay(false); });
    $("#play").addEventListener("click", () => setPlay(!playing));
    $("#back").addEventListener("click", () => { t = Math.max(0, t - 15); if (audio.src) audio.currentTime = t; paintT(); });
    $("#fwd").addEventListener("click", () => { t += 15; if (audio.src) audio.currentTime = t; paintT(); });
    $("#prev").addEventListener("click", () => { load(Math.max(0, cur - 1)); if (playing) setPlay(true); });
    $("#next").addEventListener("click", () => { load(Math.min(S.chapters.length - 1, cur + 1)); if (playing) setPlay(true); });
    const speeds = [1, 1.25, 1.5, 0.9]; let si = 0;
    $("#spd").addEventListener("click", () => { si = (si + 1) % speeds.length; audio.playbackRate = speeds[si]; $("#spd").textContent = speeds[si] + "×"; });
    toc.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) { load(+li.dataset.i); setPlay(true); } });
    load(cur);
  }
})();
