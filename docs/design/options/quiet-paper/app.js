/* Quiet Paper: shared behaviour. Vanilla JS, no network. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- icons: one 18px stroke set ---- */
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
    '<symbol id="i-clash" viewBox="0 0 18 18"><rect x="2" y="3" width="9" height="9" rx="1"/><rect x="7" y="6" width="9" height="9" rx="1"/></symbol>' +
    '<symbol id="i-down" viewBox="0 0 18 18"><path d="M4 7l5 5 5-5"/></symbol>' +
    '<symbol id="i-arrow" viewBox="0 0 18 18"><path d="M3 9h11M10 4.5L14.5 9 10 13.5"/></symbol>' +
    '<symbol id="i-copy" viewBox="0 0 18 18"><rect x="6" y="6" width="9" height="9" rx="1"/><path d="M12 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2"/></symbol>' +
    '<symbol id="i-cal" viewBox="0 0 18 18"><rect x="2.5" y="4" width="13" height="11" rx="1"/><path d="M2.5 8h13M6 2.5v3M12 2.5v3"/></symbol>' +
    '</svg>';
  document.body.insertAdjacentHTML('afterbegin', sprite);
  function icon(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  document.querySelectorAll('[data-icon]').forEach(function (el) { el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); });

  /* ---- data: Harkirat, week 8 (28 Sep - 2 Oct 2026), from seed/sem2-2026.json ---- */
  var DAYS = [
    { n: 'Mon', d: 28, full: 'Monday 28 September' },
    { n: 'Tue', d: 29, full: 'Tuesday 29 September' },
    { n: 'Wed', d: 30, full: 'Wednesday 30 September' },
    { n: 'Thu', d: 1, full: 'Thursday 1 October' },
    { n: 'Fri', d: 2, full: 'Friday 2 October' }
  ];
  var TODAY = 1, NOW = 11 * 60 + 40;
  function m(s) { var p = s.split(':'); return +p[0] * 60 + +(p[1] || 0); }
  var CLASSES = [
    { id: 'c3900-lec', code: 'COMP3900', type: 'Lecture', day: 0, a: m('13:00'), b: m('15:00'), room: 'Cinema 1.02, Lowitja O’Donoghue', one: 1 },
    { id: 'fin-lec', code: 'FINM1001', type: 'Lecture', day: 1, a: m('12:00'), b: m('14:00'), room: 'Copland Lecture Theatre', clash: 1, one: 1 },
    { id: 'c4650-lec', code: 'COMP4650', type: 'Lecture', day: 1, a: m('13:00'), b: m('15:30'), room: 'Robertson Theatre 1.28A', clash: 1, one: 1 },
    { id: 'fin-ws', code: 'FINM1001', type: 'Workshop', day: 1, a: m('16:00'), b: m('17:00'), room: 'Copland Lecture Theatre', one: 1 },
    { id: 'c4020-tut', code: 'COMP4020', type: 'Tutorial', day: 2, a: m('10:30'), b: m('12:00'), room: 'Marie Reay 4.03' },
    { id: 'c3900-tut', code: 'COMP3900', type: 'Tutorial', day: 2, a: m('14:00'), b: m('15:30'), room: 'Fulton Muir 2.03', tail: 30, change: 'resolve.html' },
    { id: 'c4650-drop', code: 'COMP4650', type: 'Optional drop-in', day: 2, a: m('15:00'), b: m('17:00'), room: 'Fulton Muir 2.04', opt: 1 },
    { id: 'fin-tut', code: 'FINM1001', type: 'Tutorial', day: 3, a: m('9:00'), b: m('10:00'), room: 'Marie Reay 3.02', change: 'swap.html' },
    { id: 'c4020-lec', code: 'COMP4020', type: 'Lecture', day: 3, a: m('11:00'), b: m('13:00'), room: 'Fulton Muir 2.02', one: 1 },
    { id: 'c4650-lab', code: 'COMP4650', type: 'Computer lab', day: 3, a: m('14:00'), b: m('15:30'), room: 'Skaidrite Darius N111', tail: 30 }
  ];
  function byId(id) { return CLASSES.filter(function (c) { return c.id === id; })[0]; }

  function t12(x) { var h = Math.floor(x / 60), mm = x % 60; return ((h % 12) || 12) + (mm ? ':' + ('0' + mm).slice(-2) : ''); }
  function ap(x) { return x >= 720 ? 'pm' : 'am'; }
  function range(a, b) { return ap(a) === ap(b) ? t12(a) + '–' + t12(b) + ap(b) : t12(a) + ap(a) + '–' + t12(b) + ap(b); }
  function at(x) { return t12(x) + ap(x); }

  /* ---- readable week: time axis, day columns, text in every block ---- */
  function week(el, o) {
    var lo = o.lo * 60, hi = o.hi * 60, act = o.active == null ? TODAY : o.active;
    function pos(a, b) { return 'top:' + ((a - lo) / (hi - lo) * 100).toFixed(3) + '%;height:' + ((b - a) / (hi - lo) * 100).toFixed(3) + '%'; }
    var moving = o.moving && byId(o.moving);
    var tabs = '', heads = '', cols = '', axis = '';
    for (var h = o.lo; h < o.hi; h++) axis += '<span style="top:' + ((h * 60 - lo) / (hi - lo) * 100).toFixed(3) + '%">' + ((h % 12) || 12) + (h === o.lo || h === 12 ? (h >= 12 ? 'pm' : 'am') : '') + '</span>';
    DAYS.forEach(function (d, di) {
      var items = [], nOn = 0, clash = false;
      CLASSES.forEach(function (c) {
        if (c.day !== di) return;
        if (moving && c.id === moving.id) {
          if (o.moved) return;
          items.push({ a: c.a, b: c.b + (c.tail || 0), c: c, k: 'now' });
          return;
        }
        items.push({ a: c.a, b: c.b + (c.tail || 0), c: c, k: 'cls' });
        if (!c.opt) nOn++;
        if (c.clash) clash = true;
      });
      if (moving && o.moved && +o.moved.day === di) items.push({ a: o.moved.a, b: o.moved.b + (o.moved.tail || 0), c: moving, k: 'moved', g: o.moved });
      if (!o.moved) (o.ghosts || []).forEach(function (g) { if (+g.day === di) items.push({ a: g.a, b: g.b + (g.tail || 0), c: moving, k: 'ghost', g: g }); });
      if (o.peek && +o.peek.day === di) items.push({ a: o.peek.a, b: o.peek.b, c: moving, k: 'bad', g: o.peek });
      if (moving && o.moved && +o.moved.day === di) nOn++;
      /* lanes: overlapping blocks sit side by side */
      items.sort(function (x, y) { return x.a - y.a; });
      var lanes = [0, 0];
      items.forEach(function (it) {
        it.over = items.some(function (z) { return z !== it && z.a < it.b && it.a < z.b; });
        var ln = lanes[0] <= it.a ? 0 : 1; lanes[ln] = it.b; it.lane = ln;
      });
      var html = '', i = 0, band = '';
      items.forEach(function (it) {
        var c = it.c, half = it.over ? (it.lane ? ' r' : ' l') : '', top = it.k === 'cls' || it.k === 'now' ? c.b : (it.g ? it.g.b : it.b), tail = it.k === 'cls' || it.k === 'now' ? c.tail : (it.g && it.g.tail);
        var cls = 'blk' + half, tag = 'div', attrs = '', body;
        var name = '<b>' + c.code + '</b><span>' + c.type + '</span>';
        var start = it.k === 'ghost' || it.k === 'moved' || it.k === 'bad' ? it.g.a : c.a;
        var tm = range(start, top);
        if (it.k === 'cls') {
          if (c.clash) cls += ' clash'; else if (c.opt) cls += ' opt'; else if (di < TODAY) cls += ' past';
          body = name + '<span class="tm">' + tm + '</span>';
          if (o.interactive) { tag = 'button'; attrs = ' type="button" aria-pressed="false" data-id="' + c.id + '"'; }
        } else if (it.k === 'now') { cls += ' now'; body = name + '<span class="tm">Now · ' + tm + '</span>'; }
        else if (it.k === 'moved') { cls += ' moved'; body = name + '<span class="tm">Moved · ' + tm + '</span>'; }
        else if (it.k === 'bad') { cls += ' bad'; body = '<b>Not possible</b><span class="tm">' + tm + '</span>'; }
        else {
          var sel = it.g.id === o.sel; cls += ' ghost' + (sel ? ' sel' : ' alt'); tag = 'button'; attrs = ' type="button" data-ghost="' + it.g.id + '" aria-label="' + (sel ? 'Chosen: ' : 'Choose ') + DAYS[di].full + ' ' + tm + '"';
          body = (sel ? name + '<span class="tm">New · ' + tm + '</span>' : '<span>Option</span><span class="tm">' + tm + '</span>');
        }
        html += '<' + tag + ' class="' + cls + '" style="' + pos(start, top) + ';--i:' + (i++) + '"' + attrs + '>' + body + '</' + tag + '>';
        if (tail) {
          html += '<div class="blk tail' + half + '" style="' + pos(top, top + tail) + ';--i:' + i + '">Optional ' + range(top, top + tail) + '</div>';
        }
      });
      var cl = items.filter(function (z) { return z.k === 'cls' && z.c.clash; });
      if (cl.length === 2) {
        var ba = Math.max(cl[0].a, cl[1].a), bb = Math.min(cl[0].b, cl[1].b);
        band = '<div class="band" style="' + pos(ba, bb) + '"><span class="chip">' + icon('clash') + 'Clash</span></div>';
      }
      var now = (o.now && di === TODAY) ? '<div class="nowmark" style="top:' + ((NOW - lo) / (hi - lo) * 100).toFixed(3) + '%"><span>Now ' + t12(NOW) + '</span></div>' : '';
      var lab = d.full + ', ' + (nOn ? nOn + (nOn === 1 ? ' class' : ' classes') : 'no classes') + (clash ? ', one clash' : '');
      heads += '<div class="wk-dh' + (di === TODAY ? ' today' : '') + '"><span class="dn">' + d.n + '</span><span class="dd">' + d.d + '</span></div>';
      tabs += '<button type="button" class="' + (di === TODAY ? 'today' : '') + '" aria-pressed="' + (di === act) + '" data-day="' + di + '" aria-label="' + lab + '"><span class="dn">' + d.n + '</span><span class="dd">' + d.d + '</span>' + (clash ? icon('clash') : '') + '</button>';
      cols += '<div class="wk-col' + (di === act ? ' on' : '') + (di < TODAY ? ' past' : '') + '" role="group" aria-label="' + lab + '">' + html + band + now + (items.length ? '' : '<div class="empty"><span>Nothing on</span></div>') + '</div>';
    });
    el.innerHTML = '<div class="wk" style="--hrs:' + (o.hi - o.lo) + '"><div class="wk-tabs">' + tabs + '</div><div class="wk-grid"><div class="wk-corner"></div>' + heads + '<div class="wk-axis" aria-hidden="true">' + axis + '</div>' + cols + '</div></div>';
    el.querySelectorAll('.wk-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { setDay(el, +b.dataset.day); if (o.onday) o.onday(+b.dataset.day); });
    });
    el._act = act;
  }
  function setDay(el, di) {
    el.querySelectorAll('.wk-tabs button').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.day === di); });
    el.querySelectorAll('.wk-col').forEach(function (c, i) { c.classList.toggle('on', i === di); });
    el._act = di;
  }

  /* ---- shared: open/close a non-modal region, focus in, Escape out ---- */
  var lastTrigger = null;
  function openOptions(trigger) {
    var op = document.getElementById('options'); if (!op) return;
    lastTrigger = trigger || lastTrigger; op.hidden = false;
    document.querySelectorAll('[data-opens="options"]').forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
    var h = document.getElementById('options-h'); h.focus({ preventScroll: true });
    op.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function closeOptions() {
    var op = document.getElementById('options'); if (!op || op.hidden) return;
    op.hidden = true;
    document.querySelectorAll('[data-opens="options"]').forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    if (lastTrigger) lastTrigger.focus();
  }

  /* ---- home ---- */
  if (document.body.dataset.page === 'home') {
    var wkEl = document.getElementById('wk'), detail = document.getElementById('detail');
    function homeWeek() { week(wkEl, { lo: 9, hi: 17, interactive: true, now: true, active: wkEl._act == null ? TODAY : wkEl._act }); }
    homeWeek();
    wkEl.addEventListener('click', function (e) {
      var b = e.target.closest('button.blk'); if (!b) return;
      wkEl.querySelectorAll('button.blk').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var c = byId(b.dataset.id), html = '<h3>' + c.code + ' ' + c.type + '</h3><p>' + DAYS[c.day].full + ', ' + range(c.a, c.b) + ' · ' + c.room + '</p>';
      if (c.tail) html += '<p>Optional drop-in ' + range(c.b, c.b + c.tail) + '</p>';
      if (c.opt) html += '<p>Optional. Doesn’t count as a clash.</p>';
      if (c.clash) html += '<p><a href="#options">Clash options</a>: it runs once, so it can’t move.</p>';
      else if (c.change) html += '<p><a href="' + c.change + '">Change this time</a></p>';
      else if (c.one) html += '<p>Runs at one time only.</p>';
      else html += '<p>Every other time is full.</p>';
      detail.innerHTML = html;
    });
    var go = document.getElementById('see-options');
    document.querySelectorAll('a[href="#options"],[data-opens="options"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); if (document.getElementById('options').hidden) openOptions(a); else closeOptions(); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOptions(); });
    if (location.hash === '#options') openOptions(document.querySelector('.top nav a[href$="#options"]'));
    window.addEventListener('hashchange', function () { if (location.hash === '#options') openOptions(); });
    var cp = document.getElementById('copy');
    cp.addEventListener('click', function () {
      var txt = document.getElementById('mail').innerText.trim(), sp = cp.querySelector('span'), done = function () { sp.textContent = 'Copied'; setTimeout(function () { sp.textContent = 'Copy email'; }, 2000); };
      function fallback() { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (x) {} ta.remove(); done(); }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
    });
    document.getElementById('ics').addEventListener('click', function () {
      function d(day, x) { var dt = new Date(2026, 8, 28 + day); return dt.getFullYear() + ('0' + (dt.getMonth() + 1)).slice(-2) + ('0' + dt.getDate()).slice(-2) + 'T' + ('0' + Math.floor(x / 60)).slice(-2) + ('0' + x % 60).slice(-2) + '00'; }
      var ev = CLASSES.map(function (c) { return 'BEGIN:VEVENT\r\nUID:' + c.id + '-w8@margin.mock\r\nDTSTAMP:20260929T114000\r\nDTSTART:' + d(c.day, c.a) + '\r\nDTEND:' + d(c.day, c.b + (c.tail || 0)) + '\r\nSUMMARY:' + c.code + ' ' + c.type + '\r\nLOCATION:' + c.room.replace(/,/g, '\\,') + '\r\nEND:VEVENT'; }).join('\r\n');
      var blob = new Blob(['BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Margin//EN\r\n' + ev + '\r\nEND:VCALENDAR'], { type: 'text/calendar' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'margin-week-8.ics'; document.body.appendChild(a); a.click(); a.remove();
    });
  }

  /* ---- guided flow (resolve + swap) ---- */
  var flow = document.body.dataset.flow;
  if (flow) {
    var radios = [].slice.call(document.querySelectorAll('input[name="slot"]'));
    var tailMin = +document.body.dataset.tail || 0;
    var ghosts = radios.map(function (r) { return { id: r.value, day: r.dataset.day, a: m(r.dataset.start), b: m(r.dataset.end), tail: tailMin, label: r.dataset.label }; });
    var pv = document.getElementById('wk'), btn = document.getElementById('confirm'), one = document.getElementById('step-pick'), two = document.getElementById('step-done');
    var toast = document.getElementById('toast'), cq = document.getElementById('conseq'), pvh = document.getElementById('pv-h');
    var cur = radios.filter(function (r) { return r.checked; })[0] || radios[0], moved = null, peek = null, tt;
    var moving = document.body.dataset.moving;
    function draw() {
      var g = ghosts.filter(function (x) { return x.id === cur.value; })[0];
      week(pv, { lo: +document.body.dataset.lo, hi: +document.body.dataset.hi, moving: moving, ghosts: ghosts, sel: cur.value, peek: peek, moved: moved, active: pv._act == null ? +cur.dataset.day : pv._act });
      btn.querySelector('span').innerHTML = (flow === 'swap' ? 'Swap to ' : 'Move to ') + cur.dataset.label;
      cq.innerHTML = '<b>If you ' + document.body.dataset.verb + ':</b> ' + cur.dataset.conseq + (cur.dataset.note ? ' ' + cur.dataset.note : '');
      document.getElementById("done-label").innerHTML = cur.dataset.label;
      pvh.textContent = moved ? 'Your week now' : 'Your week if you move';
    }
    function pick(r) { cur = r; peek = null; document.querySelectorAll('.muted-row').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); pv._act = +r.dataset.day; draw(); }
    radios.forEach(function (r) { r.addEventListener('change', function () { pick(r); }); });
    pv.addEventListener('click', function (e) { var g = e.target.closest('[data-ghost]'); if (!g) return; var r = radios.filter(function (x) { return x.value === g.dataset.ghost; })[0]; r.checked = true; pick(r); });
    document.querySelectorAll('.muted-row').forEach(function (b) {
      function show() {
        document.querySelectorAll('.muted-row').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        peek = { id: 'bad', day: b.dataset.day, a: m(b.dataset.start), b: m(b.dataset.end) }; pv._act = +b.dataset.day; draw();
      }
      b.addEventListener('click', show); b.addEventListener('focus', show);
    });
    btn.addEventListener('click', function () {
      moved = ghosts.filter(function (x) { return x.id === cur.value; })[0]; peek = null; pv._act = +moved.day; draw();
      one.hidden = true; two.hidden = false; toast.hidden = false;
      document.querySelectorAll('.crumb .dot')[1].classList.add('on'); crumb('2');
      document.getElementById('done-h').focus();
      clearTimeout(tt); tt = setTimeout(function () { toast.hidden = true; }, 10000);
    });
    document.getElementById('undo').addEventListener('click', function () {
      moved = null; two.hidden = true; one.hidden = false; toast.hidden = true; clearTimeout(tt);
      document.querySelectorAll('.crumb .dot')[1].classList.remove('on'); crumb('1'); draw(); btn.focus();
    });
    function crumb(n) { var c = document.querySelector('.crumb'); c.setAttribute('aria-label', 'Step ' + n + ' of 2'); c.querySelector('.label').textContent = 'Step ' + n + ' of 2'; }
    draw();
  }
})();
