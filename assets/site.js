/* Gurukulam site behaviour: theme, menu, role tabs, ROI calculator, forms, scroll reveal.
   Plain JavaScript, no dependencies. Every page works without it except the interactive parts. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- form backend: a Google Apps Script web app that writes to a Google Sheet and sends the emails ----------
     Setup is in _apps-script/README.md. Paste the Web app URL (it ends in /exec) between the quotes below. */
  var FORMS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyEFAHfrH7vSlg9ce_cmMCBXssygCo0OxJUlFO7OKOF2KPft2M8b7Jj7lCFAsrScpRC/exec';
  var isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var MSG_RETRY = 'We could not send that just now. Please check your connection and try again in a moment.';
  function postForm(data) {
    if (!FORMS_ENDPOINT) {
      if (isLocal) { console.warn('FORMS_ENDPOINT is empty, so nothing was sent (local preview).'); return Promise.resolve({ ok: true }); }
      return Promise.resolve({ ok: false, error: 'not-connected' });
    }
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : 0;
    // text/plain keeps this a "simple" request, so the browser can read Apps Script's reply without a CORS preflight
    return fetch(FORMS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { clearTimeout(timer); return j; })
      .catch(function () { clearTimeout(timer); return { ok: false, error: 'network' }; });
  }
  function errorText(res) {
    if (res && res.error === 'not-connected') return 'This form is not connected yet. Please try again later.';
    if (res && res.error === 'invalid') return 'Please check your details and try again.';
    if (res && res.error === 'limit') return 'We have had a lot of requests just now. Please try again a little later.';
    return MSG_RETRY;
  }
  function showError(form, msg) {
    var el = $('.formerr', form);
    if (!el) { el = document.createElement('p'); el.className = 'formerr'; el.setAttribute('role', 'alert'); form.appendChild(el); }
    el.textContent = msg;
  }
  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  /* ---------- theme ---------- */
  try {
    var saved = localStorage.getItem('gurukulam-theme');
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) {}

  /* ---------- role tabs ---------- */
  var TABS = ['management', 'teachers', 'parents'];
  function setTab(name) {
    var idx = TABS.indexOf(name);
    if (idx < 0) return;
    $$('.tabs .tab').forEach(function (b, i) {
      b.classList.toggle('on', i === idx);
      b.setAttribute('aria-selected', String(i === idx));
    });
    $$('.panel').forEach(function (p, i) { p.classList.toggle('on', i === idx); });
    var ind = $('.tabs .ind');
    if (ind) ind.style.transform = 'translateX(' + idx * 100 + '%)';
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  }

  /* ---------- calculator highlight (set from the leak tiles) ---------- */
  function setHighlight(k) {
    $$('.calc').forEach(function (c) { if (c._calc) c._calc.highlight(k); });
  }

  /* ---------- handlers named in data-on-* attributes ---------- */
  var handlers = {
    toggleTheme: function () {
      var cur = root.getAttribute('data-theme');
      var dark = cur === 'dark' || (cur !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('gurukulam-theme', next); } catch (e) {}
    },
    toggleMenu: function (e, el) {
      var d = $('#drawer');
      if (!d) return;
      d.hidden = !d.hidden;
      el.setAttribute('aria-expanded', String(!d.hidden));
    },
    decline: function () { var c = $('.consent'); if (c) c.remove(); },
    hA: function () { setHighlight('A'); },
    hB: function () { setHighlight('B'); },
    hC: function () { setHighlight('C'); },
    hD: function () { setHighlight('D'); },
    hOff: function () { setHighlight(''); },
    goM: function () { setTab('management'); },
    goT: function () { setTab('teachers'); },
    goP: function () { setTab('parents'); },
    noop: function (e) { e.preventDefault(); },
    fillExample: function (e, el) { var c = el.closest('.calc'); if (c && c._calc) c._calc.fill(); },
    clearAll: function (e, el) { var c = el.closest('.calc'); if (c && c._calc) c._calc.clear(); },
    send: function (e, el) { e.preventDefault(); var c = el.closest('.calc'); if (c && c._calc) c._calc.send(el); },
    submit: function (e, el) {
      e.preventDefault();
      var box = el.closest('.formc');
      if (!box) return;
      var v = function (id) { var n = $('#' + id, el); return n ? n.value.trim() : ''; };
      var btn = $('button[type=submit]', el);
      busy(btn, true);
      postForm({ type: 'walkthrough', school: v('b-school'), role: v('b-role'), city: v('b-city'), students: v('b-stu'), phone: v('b-ph'), email: v('b-em'), website: v('b-hp'), page: location.href })
        .then(function (res) {
          if (res && res.ok) {
            $$(':scope > *', box).forEach(function (n) { n.hidden = !n.classList.contains('done'); });
            var done = $('.done', box);
            if (done) done.hidden = false;
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
          } else {
            busy(btn, false);
            showError(el, errorText(res));
          }
        });
    }
  };
  $$('*').forEach(function (el) {
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      if (a.name.indexOf('data-on-') !== 0) return;
      var fn = handlers[a.value];
      if (fn) el.addEventListener(a.name.slice(8), function (e) { fn(e, el); });
    });
  });

  /* ---------- ROI calculator: all arithmetic stays in the browser ---------- */
  function Calc(box) {
    var DEF = { enq: '', fee: '', years: '', conv: '1', out: '', days: '5', calls: '', mins: '', staff: '', fuel: '', kmp: '', veh: '', vcost: '', riders: '', tfee: '', hrs: '', hcost: '' };
    var EX = { enq: '400', fee: '60000', years: '6', conv: '1', out: '2500000', days: '5', calls: '120', mins: '4', staff: '150', fuel: '180000', kmp: '5', veh: '1', vcost: '600000', riders: '8', tfee: '18000', hrs: '6', hcost: '600' };
    var KEYS = ['A', 'B', 'B2', 'C', 'D'];
    var GRP = ['A', 'B', 'B', 'C', 'D']; // the office-time group lights with cash released
    var inp = Object.assign({}, DEF);
    var disp = { A: 0, B: 0, B2: 0, C: 0, D: 0, Y: 0, O: 0, anchor: 0 };
    var raf = 0;
    var fields = {};
    Object.keys(DEF).forEach(function (k) { fields[k] = $('#f-' + k, box); });
    var lines = $$('.line', box), groups = $$('.grp', box);

    function num(k) { var v = parseFloat(String(inp[k] || '').replace(/,/g, '')); return isFinite(v) && v > 0 ? v : 0; }
    function inr(k) { return '₹' + num(k).toLocaleString('en-IN'); }
    function targets() {
      var A = num('enq') * (num('conv') / 100) * num('fee') * num('years');
      var B = num('out') * num('days') / 365;
      var B2 = num('calls') * 12 * num('mins') / 60 * num('staff');
      var C = num('fuel') * 12 * num('kmp') / 100 + num('veh') * num('vcost') + num('riders') * num('tfee');
      var D = num('hrs') * 52 * num('hcost');
      return { A: A, B: B, B2: B2, C: C, D: D, Y: A + B2 + C + D, O: B, anchor: num('enq') / 100 * num('fee') * num('years') };
    }
    function fmt(v, has) {
      if (!has) return '₹ —';
      if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' crore';
      if (v >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' lakh';
      return '₹' + Math.round(v).toLocaleString('en-IN');
    }
    function arith(t) {
      return {
        A: t.A ? num('enq') + ' × ' + num('conv') + '% × ' + inr('fee') + ' × ' + num('years') + ' yrs' : '',
        B: t.B ? inr('out') + ' × ' + num('days') + ' ÷ 365' : '',
        B2: t.B2 ? num('calls') + ' × 12 × ' + num('mins') + ' min ÷ 60 × ' + inr('staff') : '',
        C: t.C ? inr('fuel') + ' × 12 × ' + num('kmp') + '% + ' + num('veh') + ' × ' + inr('vcost') + ' + ' + num('riders') + ' × ' + inr('tfee') : '',
        D: t.D ? num('hrs') + ' × 52 × ' + inr('hcost') : ''
      };
    }
    function paint() {
      var t = targets(), ar = arith(t);
      lines.forEach(function (ln, i) {
        var k = KEYS[i];
        $('.am', ln).textContent = fmt(disp[k], t[k] > 0);
        var el = $('.ar', ln);
        if (ar[k]) {
          if (!el) { el = document.createElement('span'); el.className = 'ar'; ln.appendChild(el); }
          el.textContent = ar[k];
        } else if (el) el.remove();
      });
      var tb = $$('.tot b', box);
      if (tb[0]) tb[0].textContent = fmt(disp.Y, t.Y > 0);
      if (tb[1]) tb[1].textContent = fmt(disp.O, t.O > 0);
      var a = $('.anchor', box);
      if (a) {
        a.textContent = '';
        if (t.anchor > 0) {
          a.appendChild(document.createTextNode('If one extra family in a hundred enquiries joined, that alone is '));
          var b = document.createElement('b'); b.textContent = fmt(disp.anchor, true); a.appendChild(b);
        } else {
          a.appendChild(document.createTextNode('Enter your enquiries, annual fee and years enrolled to see what one extra family in a hundred enquiries is worth.'));
        }
      }
    }
    function retarget() {
      var to = targets();
      if (reduceMotion || !window.requestAnimationFrame) { disp = to; paint(); return; }
      var from = Object.assign({}, disp), t0 = performance.now();
      cancelAnimationFrame(raf);
      (function step(now) {
        var p = Math.min(1, (now - t0) / 650), e = 1 - Math.pow(1 - p, 3), cur = {};
        for (var k in to) cur[k] = (from[k] || 0) + (to[k] - (from[k] || 0)) * e;
        disp = cur; paint();
        if (p < 1) raf = requestAnimationFrame(step);
      })(t0);
    }
    function setAll(src) {
      inp = Object.assign({}, src);
      Object.keys(fields).forEach(function (k) { if (fields[k]) fields[k].value = inp[k]; });
      retarget();
    }
    Object.keys(fields).forEach(function (k) {
      if (fields[k]) fields[k].addEventListener('input', function () { inp[k] = fields[k].value; retarget(); });
    });
    box._calc = {
      fill: function () { setAll(EX); },
      clear: function () { setAll(DEF); },
      highlight: function (k) {
        groups.forEach(function (g, i) { g.classList.toggle('hl', !!k && GRP[i] === k); });
        lines.forEach(function (l, i) { l.classList.toggle('hl', !!k && GRP[i] === k); });
      },
      send: function (form) {
        var emailEl = $('input[type=email]', form);
        var btn = $('button[type=submit]', form);
        var t = targets();
        busy(btn, true);
        postForm({
          type: 'roi',
          email: emailEl ? emailEl.value.trim() : '',
          inputs: Object.assign({}, inp),
          results: { A: t.A, B: t.B, B2: t.B2, C: t.C, D: t.D, yearly: t.Y, once: t.O },
          page: location.href
        }).then(function (res) {
          if (!(res && res.ok)) { busy(btn, false); showError(form, errorText(res)); return; }
          var wrap = form.parentNode;
          var ok = document.createElement('div');
          ok.className = 'ok';
          ok.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--success)"><path d="m5 12 5 5L20 7"/></svg><span>Thank you. Your sheet is on its way to your email. If it is not there in a few minutes, check your spam folder.</span>';
          var fine = $('.fine', wrap);
          wrap.insertBefore(ok, form);
          form.remove();
          if (fine) fine.remove();
        });
      }
    };
  }
  $$('.calc').forEach(Calc);

  /* ---------- deep link to a role tab ---------- */
  var h = (location.hash || '').replace('#', '');
  if (TABS.indexOf(h) >= 0 && $('.tabs')) setTab(h);

  /* ---------- scroll-in, once per page load ----------
     The page head sets html.js (unless the visitor prefers reduced motion), which hides these elements.
     The first time one enters the viewport it gets .in, plays a short rise, and is never watched again. */
  window.__rvReady = true;
  if (root.classList.contains('js')) {
    if (!('IntersectionObserver' in window)) {
      root.classList.remove('js');
    } else {
      var targets;
      try { targets = $$('.rv, .sec .wrap > *:not(.rv):not(:has(.rv)), .ft-top > *'); }
      catch (e) { targets = $$('.rv, .ft-top > *'); }
      var io = new IntersectionObserver(function (entries) {
        var n = 0;
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.style.setProperty('--dl', (n++ * 90) + 'ms'); // stagger blocks that appear together
          en.target.classList.add('in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -6% 0px' });
      targets.forEach(function (el) { io.observe(el); });
    }
  }
})();
