/* Tawasol hub · shared runtime: language, API, session, cart, nav/footer, PWA. No build step. */
(function () {
  const C = window.TAWASOL_CONFIG || {}, D = window.TW_I18N, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ICON = (n) => `https://unpkg.com/lucide-static@0.451.0/icons/${n}.svg`;
  /* ---- language ---- */
  const saved = localStorage.getItem('tw_lang'), browser = (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : null;
  let lang = ['en', 'ar'].includes(saved) ? saved : (browser || C.defaultLang || 'en');
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const t = (k, v) => { let s = (D[lang] && D[lang][k]) ?? (D.en[k] ?? k); if (v) for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b); return s; };
  const applyLang = (root = document) => {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-i18n]', root).forEach((el) => { const [k, vars] = el.dataset.i18n.split('|'); el.textContent = t(k, vars ? JSON.parse(vars) : null); });
    $$('[data-i18n-ph]', root).forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-aria]', root).forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $$('[data-i18n-title]', root).forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.title = (document.body.dataset.title ? t(document.body.dataset.title) + ' · ' : '') + 'Tawasol';
  };
  const setLang = (l) => { lang = l; localStorage.setItem('tw_lang', l); location.reload(); };
  const pick = (o, base) => (lang === 'ar' && o[base + '_ar']) ? o[base + '_ar'] : o[base + '_en'];
  const fmt = (fils) => lang === 'ar' ? (fils / 1000).toFixed(3) + ' د.ك' : 'KD ' + (fils / 1000).toFixed(3);
  const fmtDate = (iso) => { try { return new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z')).toLocaleDateString(lang === 'ar' ? 'ar-KW' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { return iso; } };
  const mmss = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(x).padStart(2, '0'); };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* ---- device + session ---- */
  let deviceId = localStorage.getItem('tw_device'); if (!deviceId) { deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('tw_device', deviceId); }
  const deviceName = () => { const u = navigator.userAgent, os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Device', br = /CriOS|Chrome/.test(u) && !/Edg/.test(u) ? 'Chrome' : /Safari/.test(u) && !/Chrome/.test(u) ? 'Safari' : /Firefox/.test(u) ? 'Firefox' : /Edg/.test(u) ? 'Edge' : ''; return (os + ' ' + br).trim(); };
  const token = () => localStorage.getItem('tw_token') || '';
  const setToken = (v) => v ? localStorage.setItem('tw_token', v) : localStorage.removeItem('tw_token');
  /* ---- API ---- */
  const live = !!C.api;
  async function api(path, { method = 'GET', body, auth = true, raw = false } = {}) {
    if (!live) { const e = new Error('API not configured'); e.code = 'no_api'; e.status = 0; throw e; }
    if (!navigator.onLine) { const e = new Error(t('err_offline')); e.code = 'offline'; e.status = 0; throw e; }
    const h = { accept: 'application/json', 'x-device-id': deviceId }; if (body) h['content-type'] = 'application/json'; if (auth && token()) h.authorization = 'Bearer ' + token();
    const r = await fetch(C.api.replace(/\/$/, '') + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (raw) return r;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || t('err_generic')); Object.assign(e, j, { status: r.status }); if (r.status === 401 && j.code === 'signin') setToken(''); throw e; }
    return j;
  }
  /* ---- catalog (server first, bundled fallback for preview) ---- */
  const FALLBACK = { currency: 'KWD', max_devices: 3, support_email: C.supportEmail, products: [
    { id: 'print', name_en: 'Printed book (bilingual edition)', name_ar: 'الكتاب المطبوع (طبعة ثنائية اللغة)', desc_en: 'English opens from the left, Arabic from the right, and the two meet in the middle.', desc_ar: 'تُفتح الإنجليزية من اليسار والعربية من اليمين وتلتقيان في المنتصف.', kind: 'physical', price_fils: 20000, grants: [], ships: true, in_stock: true },
    { id: 'ebook', name_en: 'Ebook — English & Arabic editions', name_ar: 'الكتاب الإلكتروني — النسختان الإنجليزية والعربية', desc_en: 'Read online in your library. Both language editions are included.', desc_ar: 'اقرأ في مكتبتك على الإنترنت. تشمل النسختين الإنجليزية والعربية.', kind: 'digital', price_fils: 10000, grants: ['ebook-en', 'ebook-ar'], ships: false, in_stock: true },
    { id: 'audiobook', name_en: 'Audiobook — English', name_ar: 'الكتاب الصوتي — بالإنجليزية', desc_en: 'Written and narrated by Dr. Bibi Alamiri. Stream chapter by chapter in your library.', desc_ar: 'من تأليف وأداء د. بيبي العميري. استمع فصلاً فصلاً في مكتبتك.', kind: 'digital', price_fils: 15000, grants: ['audiobook-en'], ships: false, in_stock: true }],
    shipping_zones: [{ id: 'kw', name_en: 'Kuwait — delivery', name_ar: 'الكويت — توصيل', fee_fils: 2000, countries: ['KW'], kind: 'delivery', eta_en: '3–5 working days', eta_ar: '٣–٥ أيام عمل' }, { id: 'pickup', name_en: 'Collect from Tawasol clinic, Kuwait', name_ar: 'الاستلام من عيادة تواصل، الكويت', fee_fils: 0, countries: ['KW'], kind: 'pickup', eta_en: 'We will email you when it is ready', eta_ar: 'سنراسلك عندما تكون النسخة جاهزة' }, { id: 'gcc', name_en: 'GCC — delivery', name_ar: 'دول الخليج — توصيل', fee_fils: 6000, countries: ['SA', 'AE', 'QA', 'BH', 'OM'], kind: 'delivery', eta_en: '5–10 working days', eta_ar: '٥–١٠ أيام عمل' }, { id: 'intl', name_en: 'International — delivery', name_ar: 'دولي — توصيل', fee_fils: 12000, countries: ['*'], kind: 'delivery', eta_en: '10–20 working days', eta_ar: '١٠–٢٠ يوم عمل' }],
    editions: [{ id: 'ebook-en', kind: 'ebook', lang: 'en', title_en: 'Tawasol, The Guidebook — English ebook', title_ar: 'تواصل، الدليل — الكتاب الإلكتروني (بالإنجليزية)', reader: 'pdf', cover: 'img/cover-en.png' }, { id: 'ebook-ar', kind: 'ebook', lang: 'ar', title_en: 'Tawasol, The Guidebook — Arabic ebook', title_ar: 'تواصل، الدليل — الكتاب الإلكتروني (بالعربية)', reader: 'pdf', cover: 'img/cover-ar.png' }, { id: 'audiobook-en', kind: 'audiobook', lang: 'en', title_en: 'Tawasol, The Guidebook — English audiobook', title_ar: 'تواصل، الدليل — الكتاب الصوتي (بالإنجليزية)', cover: 'img/cover-en.png' }],
    chapters_en: ['Opening credits', 'Acknowledgment', 'Introduction', 'The Methods', 'Method I: Tawasol Model', 'Method II: Self-value Tree', 'Method III: The Boundaries Castle', 'Summaries', 'About The Book'],
    chapters_ar: ['المقدمة التعريفية', 'شكر وتقدير', 'المقدمة', 'الطرق', 'الطريقة الأولى: نموذج تواصل', 'الطريقة الثانية: شجرة قيمة الذات', 'الطريقة الثالثة: قلعة الحدود', 'الملخصات', 'عن الكتاب'],
    sample_text: { credits: ['Tawasol, The Guidebook.', 'Written and narrated by Dr. Bibi Alamiri.', 'With Sulaiman Boodai.', 'Illustrations by Marah Alkazak.'], intro: ['“Tawasol” is the Arabic word for connectedness.', 'This guide is intended for parents, adolescents, or adults who are invested in deepening their understanding of themselves as a reflection of their upbringing and present circumstances to shape the future.', 'One of the biggest myths about parenting is that you either make or break your child. This amplified view of a parent’s role in their child’s life is neither accurate nor fair to the child, the parent, or God. A parent is merely a vessel that carries their children to a specific destination. They don’t choose the destination or the route. A parent’s responsibility is to attempt to keep the journey safe, along the way.'] } };
  let catalogP = null;
  const catalog = () => catalogP || (catalogP = (async () => { try { const c = JSON.parse(sessionStorage.getItem('tw_catalog') || 'null'); if (c && Date.now() - c.at < 300000) return c.data; const data = await api('/api/catalog', { auth: false }); sessionStorage.setItem('tw_catalog', JSON.stringify({ at: Date.now(), data })); return data; } catch (_) { return FALLBACK; } })());
  /* ---- cart ---- */
  const cart = { get: () => { try { return JSON.parse(localStorage.getItem('tw_cart')) || { items: {} }; } catch (_) { return { items: {} }; } }, set: (c) => { localStorage.setItem('tw_cart', JSON.stringify(c)); paintCount(); },
    add: (id, qty = 1) => { const c = cart.get(); c.items[id] = Math.min(20, (c.items[id] || 0) + qty); cart.set(c); }, setQty: (id, q) => { const c = cart.get(); if (q <= 0) delete c.items[id]; else c.items[id] = Math.min(20, q); cart.set(c); }, clear: () => cart.set({ items: {} }), count: () => Object.values(cart.get().items).reduce((a, b) => a + b, 0) };
  const paintCount = () => $$('[data-cart-count]').forEach((el) => { const n = cart.count(); el.textContent = n || ''; el.hidden = !n; });
  /* ---- chrome ---- */
  const page = () => document.body.dataset.page;
  function nav() {
    const host = $('#nav'); if (!host) return;
    const links = [['index.html', 'nav_book', 'index'], ['checkout.html', 'nav_order', 'checkout'], ['listen.html?e=audiobook-en&sample=1', 'nav_samples', 'samples'], ['library.html', 'nav_library', 'library']];
    host.innerHTML = `<div class="wrap"><a class="brand" href="index.html"><img src="img/wordmark.png" alt="Tawasol"><span>${lang === 'ar' ? 'الدليل' : 'The Guidebook'}</span></a><div class="nav-right"><button class="btn btn-outline btn-sm ar" type="button" data-lang lang="${lang === 'ar' ? 'en' : 'ar'}" dir="${lang === 'ar' ? 'ltr' : 'rtl'}">${t('lang_switch')}</button><a class="cart-btn" href="checkout.html" aria-label="${t('nav_order')}"><span class="ico" style="--i:url(${ICON('shopping-bag')})"></span><b data-cart-count hidden></b></a><button class="menu-btn" type="button" aria-label="${t('menu')}" aria-expanded="false" data-menu><span class="ico" style="--i:url(${ICON('menu')})"></span></button></div><nav class="links">${links.map(([h, k, p]) => `<a href="${h}" ${p === page() ? 'class="on" aria-current="page"' : ''}>${t(k)}</a>`).join('')}<button class="btn btn-outline btn-sm" type="button" data-lang>${t('lang_switch')}</button><a class="btn btn-primary btn-sm" href="checkout.html">${t('order_now')}</a></nav></div>`;
    const mb = $('[data-menu]', host); mb.addEventListener('click', () => { const open = host.classList.toggle('open'); mb.setAttribute('aria-expanded', open); mb.firstElementChild.style.setProperty('--i', `url(${ICON(open ? 'x' : 'menu')})`); });
    $$('[data-lang]', host).forEach((b) => b.addEventListener('click', () => setLang(lang === 'ar' ? 'en' : 'ar')));
    paintCount();
  }
  function footer() {
    const host = $('#footer'); if (!host) return;
    host.innerHTML = `<div class="wrap"><div><img src="img/wordmark.png" alt="Tawasol"><p>${t('foot_about')}</p></div><div class="cols"><div><b>${t('foot_book')}</b><a href="index.html">${t('nav_book')}</a><a href="checkout.html">${t('nav_order')}</a><a href="library.html">${t('nav_library')}</a></div><div><b>${t('foot_tawasol')}</b><a href="mailto:${C.supportEmail}">${t('foot_support')}</a><a href="help.html">${lang === 'ar' ? 'المساعدة' : 'Help'}</a><a href="legal.html#terms">${t('foot_terms')}</a><a href="legal.html#privacy">${t('foot_privacy')}</a></div></div><div class="fine"><span>© ${new Date().getFullYear()} Tawasol · Dr. Bibi Alamiri</span><span>${t('foot_fine')}</span></div></div>`;
  }
  function continuePill() {
    const host = $('#continue'); if (!host) return; const last = JSON.parse(localStorage.getItem('tw_last_listen') || 'null'); if (!last || !token()) return;
    host.innerHTML = `<a class="mini" href="listen.html?e=${esc(last.edition)}"><span class="ico" style="--i:url(${ICON('headphones')})"></span><span><b>${t('continue_listening')}</b><small>${esc(last.title)} · ${mmss(last.position)}</small></span><span class="ico" style="--i:url(${ICON('play')})"></span></a>`;
  }
  const toast = (msg, kind = '') => { let h = $('#toast'); if (!h) { h = document.createElement('div'); h.id = 'toast'; h.setAttribute('role', 'status'); h.setAttribute('aria-live', 'polite'); document.body.appendChild(h); } h.textContent = msg; h.className = 'show ' + kind; clearTimeout(h._t); h._t = setTimeout(() => { h.className = ''; }, 3200); };
  /* ---- PWA ---- */
  let installEvt = null; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $$('[data-install]').forEach((b) => { b.hidden = false; }); });
  const install = async () => { if (!installEvt) return false; installEvt.prompt(); await installEvt.userChoice; installEvt = null; return true; };
  const isIOS = /iPhone|iPad/.test(navigator.userAgent) && !window.MSStream, standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('offline', () => { let b = $('#offline'); if (!b) { b = document.createElement('div'); b.id = 'offline'; b.className = 'offline'; document.body.prepend(b); } b.textContent = t('offline_banner'); });
  window.addEventListener('online', () => { const b = $('#offline'); if (b) b.remove(); });
  window.TW = { t, lang, setLang, pick, fmt, fmtDate, mmss, esc, api, live, catalog, cart, token, setToken, deviceId, deviceName, toast, install, isIOS, standalone, ICON, FALLBACK, applyLang, $, $$, C };
  document.addEventListener('DOMContentLoaded', () => { applyLang(); nav(); footer(); continuePill(); });
})();
