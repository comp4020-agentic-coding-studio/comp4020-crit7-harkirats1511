/* Daybook mockup: shared data + tiny renderers. Vanilla JS, no network. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- icons (one stroke set, 24 grid) ---------- */
  var ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4M12 17.2v.1"/>',
    lock: '<rect x="5.5" y="11" width="13" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 017 0v3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    copy: '<rect x="9" y="9" width="10.5" height="10.5" rx="2"/><path d="M15 9V6.5A1.5 1.5 0 0013.5 5h-7A1.5 1.5 0 005 6.5v7A1.5 1.5 0 006.5 15H9"/>',
    up: '<path d="M6 14l6-6 6 6"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7.5l8 6 8-6"/>',
    play: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
    drop: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>',
    keep: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.7 2.7 4.8-5.2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.1"/>',
    dash: '<path d="M6 12h12"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    undo: '<path d="M9 6.5L4.5 11 9 15.5"/><path d="M5 11h8.5a5 5 0 010 10H11" transform="translate(0 -3)"/>',
    mark: '<path d="M4 16a8 8 0 0116 0"/><path d="M2.5 19.5h19M12 4.5v2M5.6 8l1.4 1.4M18.4 8L17 9.4"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>'
  };
  function icon(n, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[n] + '</svg>'; }
  function hydrateIcons(root) { $$('[data-i]', root).forEach(function (el) { if (!el.firstChild) el.outerHTML = icon(el.getAttribute('data-i'), el.getAttribute('class') || ''); }); }

  /* ---------- data (week 8, Mon 28 Sep - Fri 2 Oct 2026) ---------- */
  var DAYS = [
    { k: 'Mon', long: 'Monday', d: 28, m: 'September' }, { k: 'Tue', long: 'Tuesday', d: 29, m: 'September' },
    { k: 'Wed', long: 'Wednesday', d: 30, m: 'September' }, { k: 'Thu', long: 'Thursday', d: 1, m: 'October' },
    { k: 'Fri', long: 'Friday', d: 2, m: 'October' }
  ];
  var COURSES = { COMP3900: 'hci', COMP4020: 'ags', COMP4650: 'doc', FINM1001: 'fin' };
  var HELD = [
    { id: 'hci-lec', c: 'COMP3900', kind: 'Lecture', day: 'Mon', s: '13:00', e: '15:00', room: 'Lowitja O’Donoghue Cinema 1.02' },
    { id: 'fin-lec', c: 'FINM1001', kind: 'Lecture', day: 'Tue', s: '12:00', e: '14:00', room: 'Copland Lecture Theatre' },
    { id: 'doc-lec', c: 'COMP4650', kind: 'Lecture', day: 'Tue', s: '13:00', e: '15:30', room: 'Robertson Theatre 1.28A' },
    { id: 'fin-wor', c: 'FINM1001', kind: 'Workshop', day: 'Tue', s: '16:00', e: '17:00', room: 'Copland Lecture Theatre' },
    { id: 'ags-tut', c: 'COMP4020', kind: 'Tutorial', day: 'Wed', s: '10:30', e: '12:00', room: 'Marie Reay 4.03', lock: true },
    { id: 'hci-tut', c: 'COMP3900', kind: 'Tutorial', day: 'Wed', s: '14:00', e: '15:30', room: 'Fulton Muir 2.03', tail: true },
    { id: 'doc-drop', c: 'COMP4650', kind: 'Drop-in', day: 'Wed', s: '15:00', e: '17:00', room: 'Fulton Muir 2.04', optional: true },
    { id: 'fin-tut', c: 'FINM1001', kind: 'Tutorial', day: 'Thu', s: '09:00', e: '10:00', room: 'Marie Reay 3.02' },
    { id: 'ags-lec', c: 'COMP4020', kind: 'Lecture', day: 'Thu', s: '11:00', e: '13:00', room: 'Fulton Muir 2.02' },
    { id: 'doc-lab', c: 'COMP4650', kind: 'Computer lab', day: 'Thu', s: '14:00', e: '15:30', room: 'Skaidrite Darius N111' }
  ];
  var NOW = { day: 'Tue', min: 11 * 60 + 40 };

  /* ---------- time helpers (12-hour everywhere) ---------- */
  function mins(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function clock(m) { var h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + (mm ? ':' + ('0' + mm).slice(-2) : ''); }
  function ap(m) { return m / 60 >= 12 && m / 60 < 24 ? 'pm' : 'am'; }
  function clockAp(m) { return clock(m) + ap(m); }
  function rangeM(a, b) { return ap(a) === ap(b) ? clock(a) + '–' + clock(b) + ap(b) : clock(a) + ap(a) + '–' + clock(b) + ap(b); }
  function range(s, e) { return rangeM(mins(s), mins(e)); }
  function hourLabel(h) { return (h % 12 || 12) + (h >= 12 ? 'pm' : 'am'); }
  function dayObj(k) { return DAYS.filter(function (d) { return d.k === k; })[0]; }
  function overlap(a, b) { return mins(a.s) < mins(b.e) && mins(b.s) < mins(a.e); }
  function cls(c) { return COURSES[c]; }
  function plural(n) { return n === 0 ? 'no classes' : n === 1 ? '1 class' : n + ' classes'; }
  function seatsText(n) { return n === 1 ? '1 seat left' : n + ' seats left'; }
  function endM(e) { return mins(e.e) + (e.tail ? 30 : 0); }

  /* ---------- lane layout ---------- */
  function layout(items) {
    items.sort(function (a, b) { return a.a - b.a || b.b - a.b; });
    var cluster = [], end = -1;
    function flush() {
      var ends = [];
      cluster.forEach(function (it) {
        var l = -1;
        for (var i = 0; i < ends.length; i++) { if (ends[i] <= it.a) { l = i; break; } }
        if (l < 0) l = ends.length;
        ends[l] = it.b; it.lane = l;
      });
      cluster.forEach(function (it) { it.lanes = ends.length; });
      cluster = []; end = -1;
    }
    items.forEach(function (it) { if (cluster.length && it.a >= end) flush(); cluster.push(it); end = Math.max(end, it.b); });
    if (cluster.length) flush();
    return items;
  }

  /* ---------- timeline ---------- */
  function pos(it, start, i) {
    return '--from:' + ((it.a - start * 60) / 60) + ';--len:' + ((it.b - it.a) / 60) + ';--lane:' + it.lane + ';--lanes:' + it.lanes + ';--i:' + i;
  }
  function tailHtml(endMin) { return '<div class="tailbar">Optional drop-in, ' + rangeM(endMin, endMin + 30) + '</div>'; }
  function evHtml(e, it, i, o) {
    var len = (mins(e.e) - mins(e.s)) / 60, short = len <= 1.25;
    var mine = o.mineId === e.id;
    var meta = short ? '<p class="m">' + range(e.s, e.e) + ' · ' + e.room + '</p>'
      : '<p class="m">' + range(e.s, e.e) + (e.optional ? ' · optional' : '') + '</p><p class="m">' + e.room + '</p>';
    var lock = e.lock ? '<span class="lock">' + icon('lock') + 'Can’t move</span>' : '';
    var chip = mine ? '<span class="nowchip">Now</span>' : '';
    return '<article class="ev ' + cls(e.c) + (e.optional ? ' optional' : '') + (mine ? ' mine' : '') + (mine && o.faded ? ' faded' : '') + '" data-id="' + e.id + '" style="' + pos(it, o.start, i) + '"><div class="in"><div class="body"><div class="row1"><span class="tag">' + e.c + '</span><h3>' + e.kind + (e.optional && short ? ' · optional' : '') + '</h3>' + chip + '</div>' + meta + lock + '</div>' + (e.tail ? tailHtml(mins(e.e)) : '') + '</div></article>';
  }
  function ghostHtml(g, it, i, o) {
    var st = pos(it, o.start, i), tail = g.tail ? tailHtml(mins(g.e)) : '';
    if (g.preview) {
      return '<div class="ghost ok" style="' + st + '"><div class="in"><div class="row1"><span class="tag ' + cls(g.c) + '">' + g.c + '</span><span class="g-t">New: ' + range(g.s, g.e) + '</span></div></div></div>';
    }
    var on = (g.pv ? ' pv-on' : '') + (g.hl ? ' hl-on' : '');
    if (g.legal) {
      var info = g.info ? '<span class="g-info hide-sm">' + g.info + '</span>' : '';
      return '<button type="button" class="ghost ok' + on + '" data-oid="' + g.id + '" style="' + st + '" aria-label="Move here: ' + g.dayLong + ' ' + range(g.s, g.e) + ', ' + g.seatsText + (g.info ? '. ' + g.info : '') + '"><span class="in"><span class="gmain"><span class="g-t">' + range(g.s, g.e) + '</span><span class="g-s">' + g.seatsText + '</span>' + info + '<span class="g-act">Move here ' + icon('arrow') + '</span></span>' + tail + '</span></button>';
    }
    var full = g.reason === 'Full';
    var text = full ? '' : icon('alert') + '<span>' + g.reasonShort + (g.reasonMore ? '<span class="hide-sm">' + g.reasonMore + '</span>' : '') + '</span>';
    return '<div class="ghost no' + on + '" data-oid="' + g.id + '" role="group" aria-disabled="true" tabindex="0" aria-label="Not available: ' + g.dayLong + ' ' + range(g.s, g.e) + '. ' + g.reason + '" style="' + st + '"><div class="in"><div class="gmain"><span class="g-t">' + range(g.s, g.e) + '</span>' + (full ? '<span class="reason">Full</span>' : (g.reason.indexOf('Full') === 0 ? '<span class="reason">Full</span>' : '') + '<span class="reason clashy">' + text + '</span>') + '</div>' + tail + '</div></div>';
  }
  function renderTimeline(host, o) {
    var evs = o.events, gh = o.ghosts || [];
    var items = [];
    evs.forEach(function (e) { items.push({ k: 'e', ref: e, a: mins(e.s), b: endM(e) }); });
    gh.forEach(function (g) { items.push({ k: 'g', ref: g, a: mins(g.s), b: mins(g.e) + (g.tail ? 30 : 0) }); });
    if (!items.length) {
      host.innerHTML = '<div class="empty"><b>Nothing on ' + o.dayLong + '.</b>Enjoy it.</div>';
      return;
    }
    var lo = Math.min.apply(null, items.map(function (x) { return x.a; }));
    var hi = Math.max.apply(null, items.map(function (x) { return x.b; }));
    if (o.now != null) lo = Math.min(lo, o.now);
    var start = Math.floor(lo / 60), end = Math.ceil(hi / 60);
    var flip = false;
    while (end - start < 5) { if (flip || start <= 8) end++; else start--; flip = !flip; }
    o.start = start;
    layout(items);
    var byId = {};
    var html = '<div class="tl" style="--n:' + (end - start) + '"><div class="tl-hours" aria-hidden="true">';
    for (var h = start; h <= end; h++) html += '<span class="hlab" style="top:calc(' + (h - start) + ' * var(--hr))">' + hourLabel(h) + '</span>';
    html += '</div><div class="tl-body">';
    for (h = start; h <= end; h++) html += '<div class="hl" style="top:calc(' + (h - start) + ' * var(--hr))"></div>';
    var idx = 0;
    items.forEach(function (it) { if (it.k === 'e') byId[it.ref.id] = it; html += it.k === 'e' ? evHtml(it.ref, it, idx++, o) : ghostHtml(it.ref, it, idx++, o); });
    /* clash: tint clipped to the cards, red bars on the cards' own left edges, label in the band's free corner */
    for (var i = 0; i < evs.length; i++) for (var j = i + 1; j < evs.length; j++) {
      var a = evs[i], b = evs[j];
      if (!a.optional && !b.optional && overlap(a, b)) {
        var f = Math.max(mins(a.s), mins(b.s)), t = Math.min(mins(a.e), mins(b.e)), hrs = (t - f) / 60;
        var fr = (f - start * 60) / 60, la = Math.min(byId[a.id].lane, byId[b.id].lane), ls = byId[a.id].lanes;
        html += '<div class="band" style="--from:' + fr + ';--len:' + hrs + '"><span class="lab" style="left:calc(' + la + ' * (100% - 6px) / ' + ls + ' + 14px)">' + icon('alert') + 'Clash · ' + (hrs === 1 ? '1 hour' : hrs + ' hours') + '</span></div>';
        [a, b].forEach(function (e) { var q = byId[e.id]; html += '<div class="cbar" style="--from:' + fr + ';--len:' + hrs + ';--lane:' + q.lane + ';--lanes:' + q.lanes + '"></div>'; });
      }
    }
    if (o.now != null) html += '<div class="now" style="--from:' + ((o.now - start * 60) / 60) + '"><span>' + clock(o.now) + '</span></div>';
    html += '</div></div>';
    host.innerHTML = html;
  }

  /* ---------- chip strip (slide pill) ---------- */
  function initStrip(strip, onPick) {
    var pill = document.createElement('span'); pill.className = 'strip-pill'; pill.setAttribute('aria-hidden', 'true');
    strip.insertBefore(pill, strip.firstChild);
    var tabs = $$('[role=tab]', strip);
    tabs.forEach(function (t) { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1; });
    function place(instant) {
      var sel = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
      if (!sel) return;
      if (instant) pill.style.transition = 'none';
      pill.style.width = sel.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + sel.offsetLeft + 'px)';
      if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
    }
    function select(k, focus) {
      tabs.forEach(function (t) { var on = t.dataset.day === k; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
      place(false); onPick(k);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t.dataset.day); });
      t.addEventListener('keydown', function (ev) {
        var n = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : null;
        if (n == null) return; ev.preventDefault(); select(tabs[(n + tabs.length) % tabs.length].dataset.day, true);
      });
    });
    window.addEventListener('resize', function () { place(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(true); });
    place(true);
    return { select: select, place: place };
  }

  /* ---------- toast (focus moves here so keyboard/AT users land on the result) ---------- */
  var toastEl, toastTimer;
  function toast(msg, undo) {
    if (!toastEl) {
      toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.tabIndex = -1; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<svg class="ck i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><p></p>' + (undo ? '<button type="button">' + icon('undo') + 'Undo</button>' : '');
    toastEl.querySelector('p').textContent = msg;
    toastEl.classList.remove('on'); void toastEl.offsetWidth; toastEl.classList.add('on');
    if (undo) toastEl.querySelector('button').addEventListener('click', function () { toastEl.classList.remove('on'); undo(); });
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 9000);
    try { toastEl.focus({ preventScroll: true }); } catch (e) { toastEl.focus(); }
  }

  function dayEvents(k) { return HELD.filter(function (e) { return e.day === k; }); }
  function clashCount(k) { var ev = dayEvents(k), n = 0; for (var i = 0; i < ev.length; i++) for (var j = i + 1; j < ev.length; j++) if (!ev[i].optional && !ev[j].optional && overlap(ev[i], ev[j])) n++; return n; }
  function daySpan(k) { var ev = dayEvents(k); if (!ev.length) return 'Free'; var a = Math.min.apply(null, ev.map(function (e) { return mins(e.s); })), b = Math.max.apply(null, ev.map(function (e) { return mins(e.e); })); return rangeM(a, b); }

  /* ================= HOME ================= */
  function icsText() {
    var base = { Mon: 28, Tue: 29, Wed: 30, Thu: 1, Fri: 2 }, L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daybook//Week 8//EN'];
    HELD.forEach(function (e) {
      var d = base[e.day], mo = e.day === 'Thu' || e.day === 'Fri' ? '10' : '09', dd = ('0' + d).slice(-2);
      function st(t) { return '2026' + mo + dd + 'T' + t.replace(':', '') + '00'; }
      L.push('BEGIN:VEVENT', 'UID:' + e.id + '@daybook', 'DTSTAMP:20260929T014000Z', 'DTSTART;TZID=Australia/Sydney:' + st(e.s), 'DTEND;TZID=Australia/Sydney:' + st(e.e), 'SUMMARY:' + e.c + ' ' + e.kind, 'LOCATION:' + e.room, 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n');
  }
  function initHome() {
    var host = $('#tl-host'), title = $('#tl-title'), sub = $('#tl-sub'), panel = $('#tl-panel');
    function show(k) {
      var d = dayObj(k), ev = dayEvents(k);
      title.textContent = d.long;
      sub.textContent = (k === NOW.day ? 'Today' : d.d + ' ' + d.m) + ' · ' + plural(ev.length);
      panel.setAttribute('aria-labelledby', 'chip-' + k);
      renderTimeline(host, { events: ev, dayLong: d.long, now: k === NOW.day ? NOW.min : null });
      $$('.mday').forEach(function (m) { m.setAttribute('aria-current', m.dataset.day === k); });
    }
    var strip = initStrip($('#strip'), show);
    show('Tue');
    var mini = $('#mini');
    mini.innerHTML = DAYS.map(function (d) {
      var ev = dayEvents(d.k), cc = clashCount(d.k), items = layout(ev.map(function (e) { return { e: e, a: mins(e.s), b: mins(e.e) }; }));
      var bars = items.map(function (it) { return '<span class="mbar ' + cls(it.e.c) + (it.e.optional ? ' o' : '') + '" style="--from:' + ((it.a - 540) / 60) + ';--len:' + ((it.b - it.a) / 60) + ';--lane:' + it.lane + ';--lanes:' + it.lanes + '"></span>'; }).join('');
      return '<button type="button" class="mday" data-day="' + d.k + '" aria-label="' + d.long + ' ' + d.d + ', ' + plural(ev.length) + ', ' + daySpan(d.k) + (cc ? ', ' + cc + ' clash' : '') + '"><span class="mtrack" aria-hidden="true">' + bars + '</span><span class="mlab">' + d.k + ' ' + d.d + '<small>' + daySpan(d.k) + '</small>' + (cc ? '<small class="cl">' + icon('alert', 'ci') + cc + ' clash</small>' : '') + '</span></button>';
    }).join('');
    $$('.mday', mini).forEach(function (b) { b.addEventListener('click', function () { strip.select(b.dataset.day); }); });
    $('#act-keep').addEventListener('click', function () { toast('Kept both. We’ll stop flagging it.', function () {}); });
    $('#act-rec').addEventListener('click', function () { toast('Noted. We’ll remind you to check for recordings.'); });
    var dc = $('#dropchoice');
    $('#act-drop').addEventListener('click', function () { dc.hidden = !dc.hidden; this.setAttribute('aria-expanded', !dc.hidden); });
    $$('button', dc).forEach(function (b) { b.addEventListener('click', function () { dc.hidden = true; $('#act-drop').setAttribute('aria-expanded', 'false'); toast(b.dataset.msg, function () {}); }); });
    var EMAIL = $('#email-text').textContent;
    $('#act-mail').addEventListener('click', function () {
      function done() { toast('Email copied. Paste it into a new message.'); }
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = EMAIL; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed. Select the note and copy it by hand.'); }
        document.body.removeChild(ta);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(EMAIL).then(done, fallback); else fallback();
    });
    $('#act-ics').addEventListener('click', function () {
      var url = URL.createObjectURL(new Blob([icsText()], { type: 'text/calendar' }));
      var a = document.createElement('a'); a.href = url; a.download = 'daybook-week-8.ics'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Week 8 downloaded as a calendar file.');
    });
  }

  /* ================= RESOLVE ================= */
  var OPTS = [
    { id: '01', day: 'Tue', s: '09:00', e: '10:30', seats: 7 }, { id: '02', day: 'Tue', s: '11:00', e: '12:30', seats: 0 },
    { id: '12', day: 'Tue', s: '15:00', e: '16:30', seats: 2 }, { id: '04', day: 'Wed', s: '11:00', e: '12:30', seats: 2 },
    { id: '05', day: 'Wed', s: '14:00', e: '15:30', seats: 1 }, { id: '06', day: 'Wed', s: '16:00', e: '17:30', seats: 2 },
    { id: '16', day: 'Thu', s: '16:00', e: '17:30', seats: 0 }, { id: '07', day: 'Fri', s: '09:00', e: '10:30', seats: 1 },
    { id: '08', day: 'Fri', s: '11:00', e: '12:30', seats: 0 }
  ];
  function nm(h) { return h.c + ' ' + h.kind.toLowerCase(); }
  function judge(o) {
    var r = { legal: false, reason: '', reasonShort: '', reasonMore: '', info: '' };
    var hits = HELD.filter(function (e) { return e.day === o.day && !e.optional && e.id !== 'hci-tut' && overlap(e, o); });
    var opt = HELD.filter(function (e) { return e.day === o.day && e.optional && overlap(e, o); });
    var names = 'your ' + hits.map(nm).join(' and ');
    if (o.seats === 0) { r.reason = hits.length ? 'Full, and overlaps ' + names : 'Full'; r.reasonShort = r.reason; return r; }
    if (hits.length) {
      var lock = hits.some(function (h) { return h.lock; });
      r.reasonShort = 'Overlaps ' + names + (lock ? ', which can’t move' : '');
      r.reasonMore = lock ? ' (every other time is full)' : '';
      r.reason = r.reasonShort + r.reasonMore; return r;
    }
    r.legal = true;
    if (opt.length) r.info = 'Overlaps your optional ' + opt[0].c + ' drop-in';
    return r;
  }
  function initResolve() {
    var held = '05', selDay = 'Wed', hlId = null, pv = null, moved = false, trigger = null, sheetOpener = null;
    var host = $('#tl-host'), panel = $('#panel'), list = $('#fits'), more = $('#more-list'), morecount = $('#more-count'), title = $('#tl-title'), sub = $('#tl-sub'), sheetCount = $('#sheet-count');
    var cf = $('#confirm'), scrim = $('#scrim'), mq = window.matchMedia('(max-width:899px)');
    OPTS.forEach(function (o) { var j = judge(o); o.legal = j.legal; o.reason = j.reason; o.reasonShort = j.reasonShort; o.reasonMore = j.reasonMore; o.info = j.info; o.dayLong = dayObj(o.day).long; o.seatsText = seatsText(o.seats); o.tail = true; });
    var byId = function (id) { return OPTS.filter(function (o) { return o.id === id; })[0]; };
    function order(a, b) { return DAYS.indexOf(dayObj(a.day)) - DAYS.indexOf(dayObj(b.day)) || mins(a.s) - mins(b.s); }
    function lab(o) { return o.dayLong.slice(0, 3) + ' ' + range(o.s, o.e); }
    function row(o, i) {
      if (o.legal) return '<li class="opt-row' + (hlId === o.id ? ' hl-on' : '') + '" data-oid="' + o.id + '" style="--i:' + i + '"><button type="button" class="pick" data-show="' + o.id + '"><span class="t">' + lab(o) + '</span><span class="s">' + o.seatsText + '</span>' + (o.info ? '<span class="sm">' + o.info + '</span>' : '') + '</button><button type="button" class="btn solid" data-move="' + o.id + '" aria-label="Move here: ' + lab(o) + '">Move here</button></li>';
      return '<li class="opt-row no" data-oid="' + o.id + '" style="--i:' + i + '"><button type="button" class="pick" data-show="' + o.id + '"><span class="t">' + lab(o) + '</span><span class="s">' + o.reason + '</span></button></li>';
    }
    function render() {
      var h = byId(held), d = dayObj(selDay);
      var evs = HELD.filter(function (e) { return e.day === selDay && e.id !== 'hci-tut'; });
      if (h.day === selDay) evs.push({ id: 'hci-tut', c: 'COMP3900', kind: 'Tutorial', day: h.day, s: h.s, e: h.e, room: 'Fulton Muir 2.03', tail: true });
      var ghosts = OPTS.filter(function (o) { return o.id !== held && o.day === selDay; }).map(function (o) { var g = Object.create(o); g.pv = pv === o.id; g.hl = hlId === o.id; return g; });
      renderTimeline(host, { events: evs, ghosts: ghosts, mineId: 'hci-tut', faded: !!pv, dayLong: d.long });
      title.textContent = d.long; sub.textContent = d.d + ' ' + d.m;
      var others = OPTS.filter(function (o) { return o.id !== held; }).sort(order);
      var fits = others.filter(function (o) { return o.legal; }), nope = others.filter(function (o) { return !o.legal; });
      list.innerHTML = fits.map(row).join(''); more.innerHTML = nope.map(row).join('');
      morecount.textContent = nope.length; sheetCount.textContent = fits.length + ' times fit';
      $('#now-line').textContent = 'Now: ' + lab(h) + (moved ? '. Your Tuesday lecture clash is unchanged.' : '');
      $$('#strip [role=tab]').forEach(function (t) {
        var k = t.dataset.day, has = fits.some(function (o) { return o.day === k; });
        var fit = t.querySelector('.fit'); if (fit) fit.remove();
        if (has) { var s = document.createElement('span'); s.className = 'fit'; s.setAttribute('aria-hidden', 'true'); t.appendChild(s); }
        t.setAttribute('aria-label', dayObj(k).long + ' ' + dayObj(k).d + (has ? ', has a time that fits' : ''));
      });
      renderWeek(fits, nope, h);
      document.body.classList.toggle('previewing', !!pv);
      cf.hidden = !pv;
      if (pv) {
        var o = byId(pv);
        $('#cf-text').textContent = 'You’d swap your ' + h.dayLong + ' ' + clockAp(mins(h.s)) + ' class for ' + o.dayLong + ' ' + clockAp(mins(o.s)) + '.' + (o.info ? ' It ' + o.info.replace('Overlaps', 'overlaps') + '.' : '') + ' Your Tuesday lecture clash is unchanged.';
        $('#cf-go').textContent = 'Move to ' + lab(o);
      }
      if (hlId) $$('.ghost[data-oid="' + hlId + '"]', host).forEach(function (g) { g.classList.add('hl-on'); });
    }
    function renderWeek(fits, nope, h) {
      $('#wk').innerHTML = DAYS.map(function (d) {
        var evs = HELD.filter(function (e) { return e.day === d.k && e.id !== 'hci-tut'; }).map(function (e) { return { s: e.s, e: e.e, t: 'h ' + cls(e.c), tail: false }; });
        if (h.day === d.k) evs.push({ s: h.s, e: h.e, t: 'me', tail: true });
        OPTS.filter(function (o) { return o.id !== held && o.day === d.k; }).forEach(function (o) { evs.push({ s: o.s, e: o.e, t: o.legal ? 'g' : 'n', tail: true }); });
        var items = layout(evs.map(function (x) { return { x: x, a: mins(x.s), b: mins(x.e) + (x.tail ? 30 : 0) }; }));
        var bars = items.map(function (it) { return '<span class="wkb ' + it.x.t + '" style="--from:' + ((it.a - 540) / 60) + ';--len:' + ((it.b - it.a) / 60) + ';--lane:' + it.lane + ';--lanes:' + it.lanes + '"></span>'; }).join('');
        var pills = fits.filter(function (o) { return o.day === d.k; }).map(function (o) { return '<button type="button" data-show="' + o.id + '" aria-label="Show ' + lab(o) + ', ' + o.seatsText + '">' + clockAp(mins(o.s)) + '<small>' + seatsText(o.seats).replace(' left', '') + '</small></button>'; }).join('');
        var here = h.day === d.k ? '<span class="none">Now ' + clockAp(mins(h.s)) + '</span>' : '';
        return '<div class="wkday' + (d.k === selDay ? ' sel' : '') + '"><div class="wkh">' + d.k + ' ' + d.d + '</div><div class="wkt" aria-hidden="true">' + bars + '</div><div class="wkl">' + here + (pills || (here ? '' : '<span class="none">No fit</span>')) + '</div></div>';
      }).join('');
    }
    var strip = initStrip($('#strip'), function (k) { selDay = k; hlId = null; if (pv && byId(pv).day !== k) pv = null; render(); });

    /* sheet: half-height detent, dialog semantics while open on small screens */
    var sheetBar = $('.sheet-bar', panel), pageEls = [$('.top'), $('.main'), $('.skip')];
    function setInert(on) { pageEls.forEach(function (e) { if (e) { if (on) e.setAttribute('inert', ''); else e.removeAttribute('inert'); } }); }
    function setSheet(s) {
      var open = s === 'open' && mq.matches;
      panel.setAttribute('data-state', mq.matches ? s : 'open');
      sheetBar.setAttribute('aria-expanded', open);
      if (open) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); } else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
      scrim.hidden = !open; setInert(open);
      if (open) { var hd = $('#panel-h'); hd.tabIndex = -1; hd.focus({ preventScroll: true }); }
    }
    sheetBar.addEventListener('click', function () {
      if (panel.getAttribute('data-state') === 'open') { setSheet('peek'); sheetBar.focus(); } else setSheet('open');
    });
    scrim.addEventListener('click', function () { setSheet('peek'); sheetBar.focus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (panel.getAttribute('role') === 'dialog') { setSheet('peek'); sheetBar.focus(); }
      else if (pv) cancel();
    });
    mq.addEventListener('change', function () { setSheet(mq.matches ? 'peek' : 'open'); });

    function preview(id, from) {
      pv = id; hlId = id; trigger = from || null;
      var o = byId(id); if (o.day !== selDay) { selDay = o.day; $$('#strip [role=tab]').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.day === selDay); t.tabIndex = t.dataset.day === selDay ? 0 : -1; }); strip.place(false); }
      setSheet('peek'); render();
      var hd = $('#cf-h'); hd.tabIndex = -1; hd.focus({ preventScroll: true });
      var g = $('.ghost[data-oid="' + id + '"]', host); if (g) g.scrollIntoView({ block: 'center' });
    }
    function cancel() {
      pv = null; render();
      var t = trigger && $('[data-oid="' + trigger + '"] button, button.ghost[data-oid="' + trigger + '"]');
      (t || $('#strip [aria-selected=true]')).focus();
    }
    function move(id) {
      var prev = held, prevDay = selDay, o = byId(id);
      held = id; pv = null; hlId = null; moved = true; selDay = o.day;
      $$('#strip [role=tab]').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.day === selDay); t.tabIndex = t.dataset.day === selDay ? 0 : -1; }); strip.place(false);
      render();
      toast('Moved to ' + lab(o) + '. Your Tuesday lecture clash is unchanged.', function () { held = prev; moved = false; pv = null; hlId = null; selDay = prevDay; $$('#strip [role=tab]').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.day === selDay); t.tabIndex = t.dataset.day === selDay ? 0 : -1; }); strip.place(false); render(); toast('Undone. Your tutorial is back to ' + lab(byId(prev)) + '.'); });
    }
    function show(id) {
      var o = byId(id); hlId = id;
      if (o.day !== selDay) { strip.select(o.day); hlId = id; }
      render();
      if (mq.matches) setSheet('peek');
      var g = $('.ghost[data-oid="' + id + '"]', host); if (g) g.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    $('#cf-go').addEventListener('click', function () { move(pv); });
    $('#cf-cancel').addEventListener('click', cancel);
    document.addEventListener('click', function (e) {
      var m = e.target.closest('[data-move]'), s = e.target.closest('[data-show]'), g = e.target.closest('button.ghost');
      if (m) preview(m.dataset.move, m.dataset.move); else if (g) preview(g.dataset.oid, g.dataset.oid); else if (s) show(s.dataset.show);
    });
    function hover(e, on) {
      var t = e.target.closest && e.target.closest('[data-oid]'); if (!t) return;
      $$('[data-oid="' + t.dataset.oid + '"]').forEach(function (n) { if (n.classList.contains('ghost') || n.classList.contains('opt-row')) n.classList.toggle('hl-on', on || hlId === t.dataset.oid); });
    }
    document.addEventListener('mouseover', function (e) { hover(e, true); });
    document.addEventListener('mouseout', function (e) { hover(e, false); });
    setSheet('peek');
    render();
    if (location.hash === '#sheet') setSheet('open');
    if (location.hash === '#preview') preview('06');
  }

  /* ================= SWAP ================= */
  var SWAP = [
    { id: '09', day: 'Thu', s: '17:00', e: '18:00', seats: 3, badge: 'No overlaps', why: [['good', 'Nothing overlaps it'], ['good', 'Still Thursday, so no new trip'], ['good', 'Thursday starts at 11 instead of 9'], ['neutral', 'A 1½ hour wait after your lab (3:30–5pm)']] },
    { id: '06', day: 'Wed', s: '17:00', e: '18:00', seats: 1, badge: 'No overlaps', why: [['good', 'Nothing overlaps it, not even the drop-in'], ['warn', 'Last seat, so it could go before you swap'], ['neutral', 'Wednesday would run 10:30am to 6pm']] },
    { id: '07', day: 'Wed', s: '16:00', e: '17:00', seats: 3, badge: 'Overlaps a drop-in', why: [['warn', 'Overlaps your optional COMP4650 drop-in (3–5pm)'], ['good', 'You’re on campus Wednesday anyway'], ['good', 'Thursday starts at 11 instead of 9']] }
  ];
  var ALLT = [['Tue', '17:00', '18:00', 0], ['Wed', '14:00', '15:00', 0], ['Wed', '15:00', '16:00', 0], ['Wed', '16:00', '17:00', 3], ['Wed', '17:00', '18:00', 1], ['Thu', '10:00', '11:00', 0], ['Thu', '11:00', '12:00', 0], ['Thu', '16:00', '17:00', 0], ['Thu', '17:00', '18:00', 3]];
  function initSwap() {
    var cur = { day: 'Thu', s: '09:00', e: '10:00' }, sel = '09', doneId = null;
    var cards = $('#cards'), prev = $('#pv-host'), pvTitle = $('#pv-title'), nowT = $('#now-time'), pvLine = $('#pv-line');
    function lab(x) { return dayObj(x.day).long.slice(0, 3) + ' ' + range(x.s, x.e); }
    function paint() {
      nowT.textContent = lab(cur);
      cards.innerHTML = SWAP.map(function (c, i) {
        var d = dayObj(c.day), here = doneId === c.id;
        return '<li class="card swc" data-sel="' + (sel === c.id) + '" data-id="' + c.id + '" style="--i:' + i + '"><div class="swc-top"><div><h3 class="when">' + lab(c) + '</h3><p class="seats">' + seatsText(c.seats) + ' · Marie Reay 3.02</p></div><span class="badge">' + icon(c.badge === 'No overlaps' ? 'check' : 'dash') + c.badge + '</span></div><ul class="why">' +
          c.why.map(function (w) { return '<li class="' + w[0] + '">' + icon(w[0] === 'good' ? 'check' : 'dash') + '<span>' + w[1] + '</span></li>'; }).join('') +
          '</ul><div class="swc-foot">' + (here ? '<span class="badge">' + icon('check') + 'Your time now</span>' : '<button type="button" class="btn ' + (sel === c.id ? 'solid' : '') + '" data-swap="' + c.id + '" aria-label="Swap to ' + lab(c) + '">Swap to this</button><button type="button" class="btn quiet" data-view="' + c.id + '" aria-pressed="' + (sel === c.id) + '">See my ' + d.long + '</button>') + '</div></li>';
      }).join('');
      var c = SWAP.filter(function (x) { return x.id === sel; })[0], d = dayObj(c.day);
      pvTitle.textContent = d.long + ' with this swap';
      pvLine.textContent = 'You’d swap ' + lab(cur) + ' for ' + lab(c) + '.';
      var evs = HELD.filter(function (e) { return e.day === c.day && e.id !== 'fin-tut'; });
      renderTimeline(prev, { events: evs, ghosts: [{ preview: true, c: 'FINM1001', s: c.s, e: c.e }], dayLong: d.long });
    }
    document.addEventListener('click', function (e) {
      var s = e.target.closest('[data-swap]'), v = e.target.closest('[data-view]');
      if (v) { sel = v.dataset.view; paint(); var b = $('[data-view="' + sel + '"]'); if (b) b.focus(); }
      if (s) {
        var c = SWAP.filter(function (x) { return x.id === s.dataset.swap; })[0], before = { day: cur.day, s: cur.s, e: cur.e }, bd = doneId;
        sel = c.id; cur = { day: c.day, s: c.s, e: c.e }; doneId = c.id; paint();
        toast('Swapped to ' + lab(c) + '. Your Tuesday lecture clash is unchanged.', function () { cur = before; doneId = bd; paint(); toast('Undone. Your tutorial is back to ' + lab(cur) + '.'); });
      }
    });
    $('#all-list').innerHTML = ALLT.map(function (t) {
      return '<li><span>' + lab({ day: t[0], s: t[1], e: t[2] }) + '</span>' + (t[3] ? '<span class="s">' + seatsText(t[3]) + '</span>' : '<span class="chipfull">Full</span>') + '</li>';
    }).join('');
    paint();
  }

  document.addEventListener('DOMContentLoaded', function () {
    hydrateIcons(document);
    var p = document.body.dataset.page;
    if (p === 'home') initHome(); else if (p === 'resolve') initResolve(); else if (p === 'swap') initSwap();
  });
})();
