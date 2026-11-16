/* Tawasol · live settings. The clinic team manages fees, which services are offered and the working hours from /manage/ (or “manage” on WhatsApp).
   This applies those settings on top of clinic-config.js, in place, so the chat and the pages pick them up without a new upload. */
(function (g) {
  var C = g.TAWASOL_CONFIG || {}, cfg = g.TAWASOL_CLINIC, api = String(C.assistantApi || C.api || '').replace(/\/$/, '');
  if (!cfg || !api || !g.fetch) return;
  var AR = function (n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); };
  g.TAWASOL_REMOTE = g.fetch(api + '/api/assistant/config').then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok || !Array.isArray(cfg.services)) return;
    var changed = false;
    for (var i = cfg.services.length - 1; i >= 0; i--) {
      var s = cfg.services[i], o = (d.services || {})[s.id]; if (!o) continue;
      if (typeof o.fee === 'number' && o.fee !== s.fee) { s.fee = o.fee; changed = true; }
      if (o.on === false) { cfg.services.splice(i, 1); changed = true; }
    }
    if (changed) {   // the fees answer is rebuilt from the list, so it can never disagree with what is charged
      var fq = (cfg.faqs || []).filter(function (f) { return f.id === 'fees'; })[0];
      if (fq) {
        fq.en = 'Our fees with Dr. Bibi: ' + cfg.services.map(function (x) { return x.en + ', ' + x.minutes + ' minutes, KD ' + x.fee; }).join('. ') + '. {feeNote} Would you like me to book one of them?';
        fq.ar = 'رسومنا مع د. بيبي: ' + cfg.services.map(function (x) { return x.ar + '، ' + AR(x.minutes) + ' دقيقة، ' + AR(x.fee) + ' د.ك'; }).join('. ') + '. {feeNote} هل تودّ أن أحجز لك إحداها؟';
      }
    }
    if (d.hours && d.hours.en && d.hours.ar) cfg.hours = d.hours;
    try { g.dispatchEvent(new Event('tawasol:config')); } catch (_) {}
  }).catch(function () {});
})(window);
