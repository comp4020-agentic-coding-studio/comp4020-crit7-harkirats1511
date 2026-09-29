/* Night Shift mockup. Vanilla JS, no network. One week (week 8) drawn for all three pages. */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---------- theme ---------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var savedTheme = store('ns-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') root.setAttribute('data-theme', savedTheme);
  function theme() { return root.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); }

  /* ---------- icons ---------- */
  var P = {
    swap: '<path d="M4 7h12M13 4l3 3-3 3M16 13H4M7 10l-3 3 3 3"/>',
    clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4.2l2.8 1.6"/>',
    clash: '<rect x="3" y="3" width="9.5" height="9.5" rx="1.5"/><rect x="7.5" y="7.5" width="9.5" height="9.5" rx="1.5"/>',
    sun: '<circle cx="10" cy="10" r="3.3"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    moon: '<path d="M16.5 11.8A6.8 6.8 0 0 1 8.2 3.5a6.8 6.8 0 1 0 8.3 8.3z"/>',
    x: '<path d="M5 5l10 10M15 5L5 15"/>',
    copy: '<rect x="7" y="7" width="9.5" height="9.5" rx="1.5"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>',
    check: '<path d="M4 10.5l4 4 8-9"/>',
    undo: '<path d="M7 4.5L3.5 8 7 11.5M4 8h7.5a4.5 4.5 0 0 1 0 9H8"/>',
    mail: '<rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M3 6l7 5 7-5"/>',
    film: '<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M8.5 7.5v5l4-2.5z"/>',
    user: '<circle cx="10" cy="7" r="2.8"/><path d="M4.5 16.5a5.5 5.5 0 0 1 11 0"/>',
    lock: '<circle cx="10" cy="10" r="7"/><path d="M6.5 10h7"/>',
    pause: '<path d="M7 4.5v11M13 4.5v11"/>',
    cal: '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 2.5v3M13 2.5v3M10 11v4M8 13h4"/>',
    chev: '<path d="M3 10h14M12 5l5 5-5 5"/>'
  };
  function ico(n) {
    return '<svg class="ico" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + P[n] + '</svg>';
  }

  /* ---------- time helpers: 12-hour everywhere ---------- */
  var H0 = 9, H1 = 18, NOW = 11 + 40 / 60, TODAY = 1;
  var DAYS = [['Mon', 'Monday', 28, 'Sep'], ['Tue', 'Tuesday', 29, 'Sep'], ['Wed', 'Wednesday', 30, 'Sep'], ['Thu', 'Thursday', 1, 'Oct'], ['Fri', 'Friday', 2, 'Oct']];
  var TITLES = { COMP3900: 'Human-Computer Interaction', COMP4020: 'Agentic Coding Studio', COMP4650: 'Document Analysis', FINM1001: 'Foundations of Finance' };
  function T(s) { var p = s.split(':'); return +p[0] + (+p[1] || 0) / 60; }
  function ap(n) { var h = Math.floor(n + 1e-6), m = Math.round((n - h) * 60); return { h: ((h + 11) % 12) + 1, m: m, pm: h >= 12 }; }
  function F(n) { var a = ap(n); return a.h + (a.m ? ':' + (a.m < 10 ? '0' : '') + a.m : ''); }
  function FP(n) { return F(n) + (ap(n).pm ? 'pm' : 'am'); }
  function span(s, e) { return ap(s).pm === ap(e).pm ? F(s) + '-' + FP(e) : FP(s) + '-' + FP(e); }
  function spanTxt(d, s, e) { return DAYS[d][0] + ' ' + span(s, e); }
  function seatsTxt(n) { return n === 1 ? '1 seat' : n + ' seats'; }
  function lc(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  function C(id, course, kind, day, s, e, room, weeks, extra) {
    var o = { id: id, course: course, kind: kind, day: day, s: T(s), e: T(e), room: room, weeks: weeks };
    for (var k in (extra || {})) o[k] = extra[k];
    o.eFull = o.tail ? o.e + .5 : o.e;
    return o;
  }
  function baseClasses() {
    return [
      C('c39-lec', 'COMP3900', 'Lecture', 0, '13:00', '15:00', 'Lowitja Cinema 1.02', 'weeks 1-12 except week 9', { note: 'It runs once a week, so there is nothing to swap.' }),
      C('fin-lec', 'FINM1001', 'Lecture', 1, '12:00', '14:00', 'Copland Lecture Theatre', 'weeks 1-12', { note: 'It runs at one time only.' }),
      C('c46-lec', 'COMP4650', 'Lecture', 1, '13:00', '15:30', 'Robertson Theatre 1.28A', 'weeks 1-12', { note: 'It runs at one time only.' }),
      C('fin-wor', 'FINM1001', 'Workshop', 1, '16:00', '17:00', 'Copland Lecture Theatre', 'weeks 1-12', { note: 'It runs once a week.' }),
      C('c40-tut', 'COMP4020', 'Tutorial', 2, '10:30', '12:00', 'Marie Reay 4.03', 'weeks 2-12', { fixed: true, note: 'It can’t move: every other time is full.' }),
      C('c39-tut', 'COMP3900', 'Tutorial', 2, '14:00', '15:30', 'Fulton Muir 2.03', 'weeks 2-12', { tail: true, swappable: 'resolve.html' }),
      C('c46-dro', 'COMP4650', 'Drop-in', 2, '15:00', '17:00', 'Fulton Muir 2.04', 'weeks 3-12', { dropin: true, note: 'It’s optional, and drop-ins never count as clashes.' }),
      C('fin-tut', 'FINM1001', 'Tutorial', 3, '9:00', '10:00', 'Marie Reay 3.02', 'weeks 2-12', { swappable: 'swap.html' }),
      C('c40-lec', 'COMP4020', 'Lecture', 3, '11:00', '13:00', 'Fulton Muir 2.02', 'weeks 1-12', { note: 'It runs at one time only.' }),
      C('c46-lab', 'COMP4650', 'Computer lab', 3, '14:00', '15:30', 'Darius N111', 'weeks 2, 4, 6-8 and 10', { tail: true })
    ];
  }
  function G(id, day, s, e, seats, extra) { var o = { id: id, day: day, s: T(s), e: T(e), seats: seats }; for (var k in (extra || {})) o[k] = extra[k]; return o; }
  var GH_RESOLVE = [
    G('01', 1, '9:00', '10:30', 7, { tail: true, pv: 'It adds an early Tuesday start.' }),
    G('06', 2, '16:00', '17:30', 2, { tail: true, pv: 'It runs two hours later.' }),
    G('07', 4, '9:00', '10:30', 1, { tail: true, pv: 'It adds a Friday trip, and it’s the last seat.' }),
    G('04', 2, '11:00', '12:30', 2, { tail: true, anchor: 'bottom' }),
    G('12', 1, '15:00', '16:30', 2, { tail: true }),
    G('02', 1, '11:00', '12:30', 0, { tail: true }),
    G('08', 4, '11:00', '12:30', 0, { tail: true }),
    G('16', 3, '16:00', '17:30', 0, { tail: true })
  ];
  var GH_SWAP = [
    G('09', 3, '17:00', '18:00', 3, { rank: 1, pv: 'Thursday would start at 11am instead of 9am.',
      why: [['+', 'Same day, and you start Thursday at 11am, not 9am'], ['−', 'One-hour wait after your lab ends at 4pm'], ['−', 'Finishes at 6pm']] }),
    G('06', 2, '17:00', '18:00', 1, { rank: 2, pv: 'It’s the last seat.',
      why: [['+', 'Starts after your optional COMP4650 drop-in ends'], ['+', 'Frees Thursday 9am'], ['−', 'Last seat, and you finish at 6pm']] }),
    G('07', 2, '16:00', '17:00', 3, { rank: 3, pv: 'It’s straight after your COMP3900 tutorial.',
      why: [['=', 'Overlaps your optional COMP4650 drop-in (3-5pm)'], ['+', 'Straight after your COMP3900 tutorial'], ['+', 'Frees Thursday 9am']] }),
    G('01', 2, '14:00', '15:00', 0, { more: true }), G('05', 2, '15:00', '16:00', 0, { more: true }),
    G('02', 3, '10:00', '11:00', 0, { more: true }), G('04', 3, '11:00', '12:00', 0, { more: true }),
    G('10', 3, '16:00', '17:00', 0, { more: true }), G('08', 1, '17:00', '18:00', 0, { more: true })
  ];

  var pn = location.pathname.split('/').pop().replace('.html', '');
  var page = pn === 'resolve' ? 'resolve' : pn === 'swap' ? 'swap' : 'home';
  var S = { classes: baseClasses(), ghosts: [], held: null, drawer: null, activeDay: TODAY, ghostsOn: true, showAll: false, sel: null, hover: null, undo: null, moved: null, navKey: null };
  if (page === 'resolve') { S.held = 'c39-tut'; S.ghosts = GH_RESOLVE; S.activeDay = 2; S.drawer = { type: 'options' }; }
  if (page === 'swap') { S.held = 'fin-tut'; S.ghosts = GH_SWAP; S.activeDay = 3; S.drawer = { type: 'options' }; }
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function byId(id) { for (var i = 0; i < S.classes.length; i++) if (S.classes[i].id === id) return S.classes[i]; }
  function ghost(id) { return S.ghosts.filter(function (g) { return g.id === id; })[0]; }
  function nm(c) { return c.course + ' ' + lc(c.kind); }
  function joinAnd(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  /* analyse each ghost against the other classes (main part = hard, drop-in parts = informational) */
  function analyse() {
    var held = byId(S.held);
    S.ghosts.forEach(function (g) {
      var hard = [], soft = [];
      S.classes.forEach(function (c) {
        if (c === held || c.day !== g.day) return;
        var mainOv = Math.min(c.e, g.e) - Math.max(c.s, g.s) > 1e-6;
        var anyOv = Math.min(c.eFull, g.tail ? g.e + .5 : g.e) - Math.max(c.s, g.s) > 1e-6;
        if (c.dropin) { if (anyOv) soft.push(c); } else if (mainOv) hard.push(c);
      });
      g.eFull = g.tail ? g.e + .5 : g.e;
      g.hard = hard; g.soft = soft;
      var reasons = [], fixed = hard.some(function (c) { return c.fixed; });
      var names = joinAnd(hard.map(function (c) { return 'your ' + nm(c); }));
      if (!g.seats) { g.full = true; g.reason = hard.length ? 'Full, and overlaps ' + names : 'Full'; g.chip = 'Full'; }
      else if (hard.length) { g.block = true; g.reason = 'Overlaps ' + names + (fixed ? ', which can’t move (every other time is full)' : ''); g.chip = hard.length > 1 ? 'Overlaps ' + hard.length + ' classes' : 'Overlaps ' + hard[0].course; }
      g.blocked = !!(g.full || g.block);
      g.softTxt = soft.length ? 'Overlaps your optional ' + joinAnd(soft.map(function (c) { return c.course + ' ' + lc(c.kind); })) : '';
    });
  }

  /* ---------- layout ---------- */
  function items(day) {
    var out = S.classes.filter(function (c) { return c.day === day; }).sort(function (a, b) { return a.s - b.s || (b.eFull - b.s) - (a.eFull - a.s); });
    var cluster = [], cols = [], end = -1;
    function flush() { cluster.forEach(function (it) { it.lanes = cols.length; }); cluster = []; cols = []; }
    out.forEach(function (it) {
      if (it.s >= end - 1e-6 && cluster.length) { flush(); end = -1; }
      var k = -1;
      for (var i = 0; i < cols.length; i++) if (cols[i] <= it.s + 1e-6) { k = i; break; }
      if (k < 0) { cols.push(0); k = cols.length - 1; }
      cols[k] = it.eFull; it.lane = k; cluster.push(it); end = Math.max(end, it.eFull);
    });
    flush();
    return out;
  }
  function clashes() {
    var list = [];
    for (var d = 0; d < 5; d++) {
      var it = items(d).filter(function (x) { return !x.dropin; });
      for (var i = 0; i < it.length; i++) for (var j = i + 1; j < it.length; j++) {
        var s = Math.max(it[i].s, it[j].s), e = Math.min(it[i].e, it[j].e);
        if (e - s > 1e-6) list.push({ day: d, s: s, e: e, a: it[i], b: it[j] });
      }
    }
    return list;
  }
  function sty(s, e, lane, lanes, tail) {
    return '--top:' + ((s - H0) / (H1 - H0) * 100).toFixed(3) + ';--h:' + ((e - s) / (H1 - H0) * 100).toFixed(3) + ';--lane:' + (lane || 0) + ';--lanes:' + (lanes || 1) + (tail ? ';--tail:' + (.5 / (e - s) * 100).toFixed(2) : '');
  }
  function hue(c) { return c.kind === 'Lecture' ? 'var(--h-lec)' : 'var(--h-grp)'; }

  /* ---------- board ---------- */
  function renderBoard() {
    var b = $('board'), html = '', cl = clashes(), inClash = {};
    cl.forEach(function (x) { inClash[x.a.id] = 1; inClash[x.b.id] = 1; });
    var count = [0, 0, 0, 0, 0];
    if (S.ghostsOn) S.ghosts.forEach(function (g) { if (!g.more && !g.blocked) count[g.day]++; });
    var held = S.held && byId(S.held);
    html += '<nav class="tabs" aria-label="Choose a day">';
    DAYS.forEach(function (d, i) {
      html += '<button type="button" class="tab' + (i === TODAY ? ' is-today' : '') + '" data-day="' + i + '" aria-pressed="' + (i === S.activeDay) + '"' + (i === TODAY ? ' aria-current="date"' : '') + '><span class="tab-n">' + d[0] + '</span><span class="tab-d">' + d[2] + '</span>' + (count[i] ? '<span class="tab-badge"><span class="sr">' + count[i] + ' open times</span><span aria-hidden="true">' + count[i] + '</span></span>' : '') + '</button>';
    });
    html += '</nav><div class="grid" data-active="' + S.activeDay + '" role="group" aria-label="Week board. Use the arrow keys to move between classes.">';
    html += '<div class="corner"></div>';
    DAYS.forEach(function (d, i) {
      html += '<div class="dayhead' + (i === TODAY ? ' is-today' : '') + '"><span class="dh-n">' + d[0] + '</span> <span class="dh-d">' + d[2] + '</span>' + (i === TODAY ? '<span class="dh-tag">Today</span>' : '') + '</div>';
    });
    html += '<div class="gutter" aria-hidden="true">';
    for (var h = H0; h < H1; h++) html += '<span style="--top:' + ((h - H0) / (H1 - H0) * 100) + '">' + F(h) + (ap(h).pm ? 'pm' : 'am') + '</span>';
    html += '<span class="nowlabel" style="--top:' + ((NOW - H0) / (H1 - H0) * 100) + '">11:40</span></div>';
    for (var d = 0; d < 5; d++) {
      var its = items(d), anyGhost = S.ghostsOn && S.ghosts.some(function (g) { return g.day === d && (!g.more || S.showAll); });
      html += '<section class="day' + (d === TODAY ? ' is-today' : '') + (d === S.activeDay ? ' is-active' : '') + '" data-day="' + d + '" aria-label="' + DAYS[d][1] + ' ' + DAYS[d][2] + ' ' + DAYS[d][3] + '">';
      if (!its.length) html += '<p class="free">' + (anyGhost ? '' : 'Nothing on') + '</p>';
      cl.filter(function (x) { return x.day === d; }).forEach(function (x) {
        html += '<div class="clash-band" aria-hidden="true" style="' + sty(x.s, x.e, 0, 1) + '"></div>';
      });
      its.forEach(function (c, n) {
        var isHeld = S.held === c.id;
        var lab = c.course + ' ' + c.kind + ', ' + DAYS[d][1] + ' ' + span(c.s, c.e) + ', ' + c.room + (c.tail ? '. Optional drop-in ' + span(c.e, c.eFull) : '') + (isHeld ? '. This is your current time.' : '');
        html += '<button type="button" data-nav data-key="' + c.id + '" class="evt' + (c.dropin ? ' is-dropin' : '') + (inClash[c.id] ? ' in-clash' : '') + (isHeld ? ' is-held' : '') + ((S.drawer && S.drawer.id === c.id) ? ' is-selected' : '') + '" data-id="' + c.id + '" style="' + sty(c.s, c.eFull, c.lane, c.lanes, c.tail) + ';--hue:' + hue(c) + ';--i:' + (d + n) + '" aria-label="' + esc(lab) + '">' +
          '<span class="evt-main"><span class="evt-code">' + c.course + (isHeld && S.ghostsOn ? '<span class="evt-now">Now</span>' : '') + '</span><span class="evt-kt"><span class="evt-kind">' + c.kind + '</span> <span class="evt-time">' + span(c.s, c.e) + '</span></span><span class="evt-room">' + esc(c.room) + '</span></span>' +
          (c.tail ? '<span class="evt-tail">Optional drop-in<span class="tl-x">&nbsp;to ' + FP(c.eFull) + '</span></span>' : '') + '</button>';
      });
      cl.filter(function (x) { return x.day === d; }).forEach(function (x) {
        var mins = Math.round((x.e - x.s) * 60);
        var lab = 'Clash: ' + nm(x.a) + ' and ' + nm(x.b) + ' overlap ' + span(x.s, x.e) + '. Open your options.';
        html += '<span class="clash-frame" aria-hidden="true" style="' + sty(x.s, x.e, 0, 1) + '"></span>' +
          '<button type="button" data-nav data-key="clash" class="clash-chip" data-clash="1" style="' + sty(x.s, x.e, 0, 1) + '" aria-label="' + esc(lab) + '">' + ico('clash') + '<span>Clash <span class="mono">' + (mins % 60 ? mins + ' min' : (mins / 60) + ' hr') + '</span></span></button>';
      });
      if (S.ghostsOn) S.ghosts.forEach(function (g) {
        if (g.day !== d || (g.more && !S.showAll)) return;
        var lab = 'Other time: ' + DAYS[d][1] + ' ' + span(g.s, g.e) + '. ' + (g.blocked ? g.reason + '. Not available.' : seatsTxt(g.seats) + ' left' + (g.softTxt ? '. ' + g.softTxt : '') + '. Choose this time.');
        var st = sty(g.s, g.eFull, 0, 1, g.tail);
        var isSel = S.sel === g.id;
        if (g.blocked) {
          html += '<div class="ghost-box' + (g.tail ? ' has-tail' : '') + '" aria-hidden="true" style="' + st + '"></div>' +
            '<button type="button" data-nav data-key="g' + g.id + '" class="ghost-chip' + (g.anchor ? ' at-bottom' : '') + (S.hover === g.id ? ' is-preview' : '') + '" data-ghost="' + g.id + '" aria-disabled="true" style="' + st + '" aria-label="' + esc(lab) + '">' + ico(g.full ? 'lock' : 'clash') + esc(g.chip) + '</button>';
        } else {
          html += '<button type="button" data-nav data-key="g' + g.id + '" class="ghost is-legal' + (isSel ? ' is-sel' : '') + (S.hover === g.id ? ' is-preview' : '') + '" data-ghost="' + g.id + '" style="' + st + '" aria-label="' + esc(lab) + '">' +
            '<span class="ghost-main"><span class="ghost-line"><span class="mono">' + span(g.s, g.e) + '</span><span class="seats">' + ico('user') + seatsTxt(g.seats) + '</span></span><span class="ghost-go">' + (isSel ? ico('check') + 'Chosen' : 'Choose') + '</span></span>' + (g.tail ? '<span class="ghost-tail">Optional drop-in</span>' : '') + '</button>';
        }
      });
      if (d === TODAY) html += '<div class="nowline" style="--top:' + ((NOW - H0) / (H1 - H0) * 100) + '" aria-hidden="true"></div>';
      html += '</section>';
    }
    html += '</div>';
    b.innerHTML = html;
    b.setAttribute('data-ghosts', S.ghostsOn ? 'on' : 'off');
    rove();
    refreshDim();
  }

  /* roving tabindex: the whole board is one tab stop, arrows move inside */
  function navEls() { return [].slice.call(document.querySelectorAll('#board [data-nav]')); }
  function rove() {
    var els = navEls(), pick = els.filter(function (e) { return e.getAttribute('data-key') === S.navKey; })[0] || els[0];
    els.forEach(function (e) { e.tabIndex = e === pick ? 0 : -1; });
  }
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('#board [data-nav]');
    if (el) { S.navKey = el.getAttribute('data-key'); navEls().forEach(function (x) { x.tabIndex = x === el ? 0 : -1; }); }
  });

  /* ---------- top bar ---------- */
  function renderTopbar() {
    var isLight = theme() === 'light';
    var cur = function (p) { return page === p ? ' aria-current="page"' : ''; };
    $('topbar').innerHTML =
      '<a class="brand" href="index.html" aria-label="Night Shift, My week"' + cur('home') + '><svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 16V8M10 16V4M16 16v-5"/></svg><span>Night Shift</span></a>' +
      '<p class="wk-label"><b>Week 8</b> of 12</p>' +
      '<nav class="tools" aria-label="Tools">' +
      '<a class="ib" href="resolve.html" data-tip="Change a class" aria-label="Change a class"' + cur('resolve') + '>' + ico('swap') + '<span class="ib-l">Change a class</span></a>' +
      '<a class="ib" href="swap.html" data-tip="Find a better time" aria-label="Find a better time"' + cur('swap') + '>' + ico('clock') + '<span class="ib-l">Better time</span></a>' +
      '<button type="button" class="ib" data-act="theme" data-tip="' + (isLight ? 'Dark mode' : 'Light mode') + '" aria-label="' + (isLight ? 'Switch to dark mode' : 'Switch to light mode') + '">' + ico(isLight ? 'moon' : 'sun') + '<span class="ib-l">' + (isLight ? 'Dark' : 'Light') + '</span></button></nav>';
  }

  /* ---------- strip ---------- */
  function renderStrip() {
    var el = $('strip'), x = '', h = { home: 'My week', resolve: 'Change a class', swap: 'Find a better time' }[page];
    if (page === 'home') {
      x = '<p class="next"><span class="lbl">Next up</span> <b>FINM1001 Lecture</b> <span><span class="mono">12pm</span>, Copland Lecture Theatre</span> <span class="mins mono">in 20 min</span></p>' +
        '<p class="alert">' + ico('clash') + '<span>Two Tuesday lectures overlap.</span><button type="button" class="btn btn-sm" data-act="open-clash">See options</button></p>' +
        '<button type="button" class="btn btn-ghost btn-sm cal" data-act="ics">' + ico('cal') + 'Add to my calendar (.ics)</button>';
    } else {
      x = '<p class="hint" id="hint">Dashed slots are other times for your ' + (page === 'resolve' ? 'Wednesday' : 'Thursday') + ' tutorial.</p>';
    }
    el.innerHTML = '<h1>' + h + '</h1>' + x;
  }

  /* ---------- drawer ---------- */
  var EMAIL = 'Hi, I’m enrolled in FINM1001 and COMP4650. Their Tuesday lectures overlap from 1 to 2pm (FINM1001 12-2pm, COMP4650 1-3:30pm) and each runs at one time only. Is there a recording, or another way to cover the hour? Thanks, Harkirat';
  function head(kicker, title, meta) {
    return '<div class="dr-head"><div><p class="dr-kick mono">' + kicker + '</p><h2 id="dr-title" tabindex="-1">' + title + '</h2>' + (meta ? '<p class="dr-meta">' + meta + '</p>' : '') + '</div><button type="button" class="ib ib-plain" data-act="close" aria-label="Close panel">' + ico('x') + '</button></div>';
  }
  function grip() { return '<button type="button" class="dr-grip" data-act="sheet" aria-label="Make panel taller or shorter" aria-expanded="false"><span></span></button>'; }
  function swapLine(g) {
    var h = byId(S.held);
    return 'You’d swap ' + spanTxt(h.day, h.s, h.e) + ' for ' + spanTxt(g.day, g.s, g.e) + '. ' + (g.pv || '') + (g.softTxt ? ' ' + g.softTxt + '.' : '');
  }
  function drawerHTML() {
    var d = S.drawer; if (!d) return '';
    if (d.type === 'clash') {
      return grip() + head('Clash · Tuesday', 'Two lectures overlap', 'Tue 1-2pm, every week') +
        '<div class="dr-body"><p class="lead">FINM1001 (12-2pm) and COMP4650 (1-3:30pm) overlap for an hour. <b>This can’t be fixed:</b> each lecture runs at one time only.</p>' +
        '<ul class="opts">' +
        '<li class="opt"><span class="opt-i">' + ico('pause') + '</span><div><h3>Keep both</h3><p>You’d miss an hour of one lecture each week.</p></div><button type="button" class="btn btn-ghost" data-act="keep">Keep it</button></li>' +
        '<li class="opt"><span class="opt-i">' + ico('film') + '</span><div><h3>Check for recordings</h3><p>Look on each course site to see if the lecture is recorded.</p></div></li>' +
        '<li class="opt"><span class="opt-i">' + ico('x') + '</span><div><h3>Drop one</h3><p>Only if you can’t cover the hour. Do it in your enrolment.</p></div></li>' +
        '<li class="opt"><span class="opt-i">' + ico('mail') + '</span><div><h3>Ask the convenor</h3><p>Copy this and send it.</p></div><button type="button" class="btn btn-ghost" data-act="copy">' + ico('copy') + '<span>Copy email</span></button><label class="sr" for="email">Email to the convenor</label><textarea id="email" class="email" rows="5" readonly>' + esc(EMAIL) + '</textarea></li>' +
        '</ul></div>';
    }
    if (d.type === 'info') {
      var c = byId(d.id) || {};
      var act = c.swappable && page === 'home' ? '<a class="btn" href="' + c.swappable + '">See other times' + ico('chev') + '</a>' : '';
      var back = page !== 'home' ? '<button type="button" class="btn btn-ghost" data-act="back">Back to other times</button>' : '';
      return grip() + head(c.course + ' · ' + c.kind, TITLES[c.course], spanTxt(c.day, c.s, c.e)) +
        '<div class="dr-body"><dl class="facts"><div><dt>Where</dt><dd>' + esc(c.room) + '</dd></div><div><dt>Runs</dt><dd>' + esc(c.weeks) + '</dd></div>' + (c.tail ? '<div><dt>Then</dt><dd>Optional drop-in, ' + span(c.e, c.eFull) + '</dd></div>' : '') + '</dl>' +
        (c.note ? '<p class="lead">' + esc(c.note) + '</p>' : '') + '<div class="btn-row">' + act + back + '</div></div>';
    }
    if (d.type === 'moved') {
      return grip() + head('Done', 'Moved to ' + S.moved.label + '.', null) +
        '<div class="dr-body"><p class="lead">Your Tuesday lecture clash is unchanged.</p><div class="btn-row"><button type="button" class="btn btn-ghost only-narrow" data-act="undo">' + ico('undo') + '<span>Undo</span></button></div></div>';
    }
    var held = byId(S.held), body = '', word = page === 'resolve' ? 'Move' : 'Swap';
    var legal = S.ghosts.filter(function (g) { return !g.blocked && !g.more; });
    if (page === 'resolve') {
      body = '<p class="lead">' + legal.length + ' other times work.</p><ul class="rows" aria-label="Other times">' + rowsHTML(S.ghosts) + '</ul>';
    } else {
      var top = legal.sort(function (a, b) { return a.rank - b.rank; });
      body = '<h3 class="sub">Better than what you have</h3><p class="rule">No overlaps first, then most seats to spare.</p><ol class="cards">';
      top.forEach(function (g) {
        body += '<li class="card" data-row="' + g.id + '"><input class="sr" type="radio" name="pick" id="pk' + g.id + '" value="' + g.id + '"' + (S.sel === g.id ? ' checked' : '') + '><label for="pk' + g.id + '" class="card-top"><span class="rank mono"><span class="sr">Rank </span>' + g.rank + '</span><b class="mono">' + spanTxt(g.day, g.s, g.e) + '</b><span class="seats">' + ico('user') + seatsTxt(g.seats) + '</span></label><ul class="why">';
        g.why.forEach(function (w) { body += '<li><span class="w" aria-hidden="true">' + w[0] + '</span><span class="sr">' + ({ '+': 'Plus: ', '−': 'Minus: ', '=': 'Note: ' })[w[0]] + '</span>' + w[1] + '</li>'; });
        body += '</ul></li>';
      });
      body += '</ol><button type="button" class="linkbtn" data-act="showall" aria-expanded="' + S.showAll + '">' + (S.showAll ? 'Hide the full times' : 'Show all times (the rest are full)') + '</button>';
      if (S.showAll) body += '<ul class="rows rows-compact" aria-label="Full times">' + rowsHTML(S.ghosts.filter(function (g) { return g.more; })) + '</ul>';
    }
    return grip() + head(held.course + ' · ' + held.kind, 'Your ' + DAYS[held.day][1] + ' ' + lc(held.kind), 'Now: ' + spanTxt(held.day, held.s, held.e) + ', ' + held.room + (held.tail ? '<br>Optional drop-in, ' + span(held.e, held.eFull) : '')) +
      '<div class="dr-body">' + body + '</div>' +
      '<div class="dr-foot" id="foot"><p class="ifmove"><span class="lbl">If you move</span> <span class="pv" id="pv" aria-live="polite">Choose a time to see what changes.</span></p><button type="button" class="btn" id="confirm" data-act="confirm" data-word="' + word + '" aria-disabled="true">Choose a time</button></div>';
  }
  function rowsHTML(list) {
    var order = list.slice().sort(function (a, b) { return (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0) || a.day - b.day || a.s - b.s; });
    return order.map(function (g) {
      var when = spanTxt(g.day, g.s, g.e);
      if (g.blocked) return '<li class="row is-blocked" data-row="' + g.id + '" tabindex="0" aria-label="' + esc(when + '. ' + g.reason + '. Not available.') + '"><span class="row-when mono">' + when + '</span><span class="chip">' + ico(g.full ? 'lock' : 'clash') + esc(g.chip) + '</span><span class="row-why">' + esc(g.reason) + '</span></li>';
      return '<li class="row" data-row="' + g.id + '"><input class="sr" type="radio" name="pick" id="pk' + g.id + '" value="' + g.id + '"' + (S.sel === g.id ? ' checked' : '') + '><label for="pk' + g.id + '" class="row-l"><span class="row-when mono">' + when + '</span><span class="seats">' + ico('user') + seatsTxt(g.seats) + '</span></label>' + (g.softTxt ? '<span class="row-why">' + esc(g.softTxt) + '</span>' : '') + '</li>';
    }).join('');
  }

  var lastFocus = null;
  function isNarrow() { return window.matchMedia('(max-width: 860px)').matches; }
  function openDrawer(d, focus) {
    if (!lastFocus || !document.contains(lastFocus)) lastFocus = document.activeElement;
    S.drawer = d; S.ghostsOn = true; S.hover = null;
    paintDrawer(); renderBoard();
    document.body.setAttribute('data-drawer', 'open');
    document.body.removeAttribute('data-sheet');
    $('drawer').removeAttribute('inert');
    if (focus !== false) { var h = $('dr-title'); if (h) h.focus({ preventScroll: true }); }
    if (isNarrow()) scrollToTabs();
  }
  function scrollToTabs() { var tb = document.querySelector('.tabs'); if (tb) window.scrollTo(0, tb.getBoundingClientRect().top + window.scrollY); }
  function paintDrawer() { $('drawer').innerHTML = drawerHTML(); applySel(); }
  function closeDrawer() {
    S.drawer = null; S.hover = null; S.sel = null; if (page !== 'home') S.ghostsOn = false;
    document.body.setAttribute('data-drawer', 'closed');
    $('drawer').setAttribute('inert', '');
    renderBoard();
    var t = (lastFocus && document.contains(lastFocus)) ? lastFocus : (document.querySelector('.evt.is-held') || document.querySelector('.brand'));
    if (t && t.focus) t.focus({ preventScroll: true });
    lastFocus = null;
  }

  /* selection: two steps (choose, then confirm) */
  function refreshDim() {
    var on = !!(S.sel || S.hover) && S.ghostsOn;
    document.querySelectorAll('.evt.is-held').forEach(function (h) { h.classList.toggle('is-dim', on); });
  }
  function applySel() {
    var id = S.hover || S.sel, g = id && ghost(id), sg = S.sel && ghost(S.sel);
    document.querySelectorAll('[data-ghost]').forEach(function (el) {
      var i = el.getAttribute('data-ghost');
      el.classList.toggle('is-preview', S.hover === i);
      if (el.classList.contains('ghost')) {
        el.classList.toggle('is-sel', S.sel === i);
        var go = el.querySelector('.ghost-go'); if (go) go.innerHTML = S.sel === i ? ico('check') + 'Chosen' : 'Choose';
      }
    });
    document.querySelectorAll('[data-row]').forEach(function (r) {
      var i = r.getAttribute('data-row');
      r.classList.toggle('is-preview', S.hover === i); r.classList.toggle('is-sel', S.sel === i);
      var inp = r.querySelector('input'); if (inp) inp.checked = S.sel === i;
    });
    var pv = $('pv'), cf = $('confirm');
    if (pv) pv.textContent = g ? (g.blocked ? g.reason + '.' : swapLine(g)) : 'Choose a time to see what changes.';
    if (cf) {
      if (sg) { cf.textContent = cf.getAttribute('data-word') + ' to ' + spanTxt(sg.day, sg.s, sg.e); cf.setAttribute('aria-disabled', 'false'); }
      else { cf.textContent = 'Choose a time'; cf.setAttribute('aria-disabled', 'true'); }
    }
    refreshDim();
  }
  function choose(id, fromRow) {
    var g = ghost(id); if (!g || g.blocked) return;
    S.sel = id;
    if (isNarrow() && g.day !== S.activeDay) { S.activeDay = g.day; renderBoard(); }
    applySel();
    if (isNarrow()) { var el = document.querySelector('.ghost[data-ghost="' + id + '"]'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 130); }
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg, undo) {
    var t = $('toast');
    t.setAttribute('data-kind', undo ? 'undo' : 'note');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" class="toast-btn" data-act="undo">' + ico('undo') + 'Undo</button>' : '') + '<button type="button" class="toast-x" data-act="toast-close" aria-label="Dismiss message">' + ico('x') + '</button>';
    t.classList.remove('is-in'); void t.offsetWidth; t.classList.add('is-in');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-in'); }, undo ? 12000 : 4000);
  }
  function hideToast() { $('toast').classList.remove('is-in'); }

  /* ---------- actions ---------- */
  function doConfirm() {
    var g = S.sel && ghost(S.sel); if (!g) return;
    var c = byId(S.held);
    S.undo = { day: c.day, s: c.s, e: c.e, eFull: c.eFull };
    c.day = g.day; c.s = g.s; c.e = g.e; c.eFull = c.tail ? g.e + .5 : g.e;
    S.moved = { label: spanTxt(g.day, g.s, g.e) };
    S.sel = null; S.hover = null; S.ghostsOn = false; S.activeDay = g.day;
    S.drawer = { type: 'moved' };
    var hint = $('hint'); if (hint) hint.textContent = 'Moved to ' + S.moved.label + '. Your Tuesday lecture clash is unchanged.';
    paintDrawer(); renderBoard();
    toast('Moved to ' + S.moved.label + '.', true);
    var h = $('dr-title'); if (h) h.focus({ preventScroll: true });
  }
  function doUndo() {
    if (!S.undo) return;
    var c = byId(S.held); c.day = S.undo.day; c.s = S.undo.s; c.e = S.undo.e; c.eFull = S.undo.eFull; S.undo = null; S.moved = null;
    S.activeDay = c.day; hideToast();
    var hint = $('hint'); if (hint) hint.textContent = 'Dashed slots are other times for your ' + (page === 'resolve' ? 'Wednesday' : 'Thursday') + ' tutorial.';
    analyse();
    openDrawer({ type: 'options' });
  }
  function copyEmail(btn) {
    var ta = $('email'), done = function () { btn.querySelector('span').textContent = 'Copied'; toast('Email copied.'); setTimeout(function () { if (btn.isConnected) btn.querySelector('span').textContent = 'Copy email'; }, 2200); };
    var fallback = function () { ta.removeAttribute('readonly'); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Select the text and copy it.'); } ta.setAttribute('readonly', ''); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(EMAIL).then(done, fallback); else fallback();
  }
  function ics() {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Night Shift//EN'];
    function stamp(day, n) { var dd = 28 + day, mon = '09'; if (dd > 30) { dd -= 30; mon = '10'; } var a = ap(n); var hh = Math.floor(n + 1e-6), mm = Math.round((n - hh) * 60); return '2026' + mon + (dd < 10 ? '0' : '') + dd + 'T' + (hh < 10 ? '0' : '') + hh + (mm < 10 ? '0' : '') + mm + '00'; }
    baseClasses().forEach(function (c) {
      L.push('BEGIN:VEVENT', 'UID:' + c.id + '@night-shift', 'DTSTAMP:20260929T000000', 'DTSTART:' + stamp(c.day, c.s), 'DTEND:' + stamp(c.day, c.e), 'SUMMARY:' + c.course + ' ' + c.kind, 'LOCATION:' + c.room, 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    var url = URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar' }));
    var a = document.createElement('a'); a.href = url; a.download = 'my-week-8.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Saved my-week-8.ics.');
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act],[data-id],[data-ghost],[data-clash],.tab');
    if (!el) return;
    var a = el.getAttribute('data-act');
    if (el.classList.contains('tab')) { S.activeDay = +el.getAttribute('data-day'); renderBoard(); var t = document.querySelector('.tab[aria-pressed="true"]'); if (t) t.focus({ preventScroll: true }); return; }
    if (el.hasAttribute('data-ghost')) { var gid = el.getAttribute('data-ghost'); var g = ghost(gid); if (g.blocked) { S.hover = gid; applySel(); return; } choose(gid); return; }
    if (el.hasAttribute('data-clash')) { lastFocus = el; openDrawer({ type: 'clash' }); return; }
    if (el.classList.contains('evt')) {
      var id = el.getAttribute('data-id'); lastFocus = el;
      if ((page === 'resolve' || page === 'swap') && id === S.held) openDrawer({ type: 'options' }); else openDrawer({ type: 'info', id: id });
      return;
    }
    switch (a) {
      case 'theme': var n = theme() === 'light' ? 'dark' : 'light'; root.setAttribute('data-theme', n); store('ns-theme', n); renderTopbar(); var b = document.querySelector('[data-act=theme]'); if (b) b.focus(); break;
      case 'open-clash': lastFocus = el; openDrawer({ type: 'clash' }); break;
      case 'close': closeDrawer(); break;
      case 'back': openDrawer({ type: 'options' }); break;
      case 'confirm': if (el.getAttribute('aria-disabled') === 'true') { toast('Choose a time first.'); } else doConfirm(); break;
      case 'undo': doUndo(); break;
      case 'toast-close': hideToast(); break;
      case 'copy': copyEmail(el); break;
      case 'ics': ics(); break;
      case 'keep': toast('Kept. It stays flagged on My week.'); break;
      case 'sheet': var full = document.body.getAttribute('data-sheet') === 'full'; if (full) document.body.removeAttribute('data-sheet'); else document.body.setAttribute('data-sheet', 'full'); el.setAttribute('aria-expanded', String(!full)); break;
      case 'showall': S.showAll = !S.showAll; S.sel = null; paintDrawer(); renderBoard(); var sb = document.querySelector('[data-act=showall]'); if (sb) sb.focus(); break;
    }
  });
  document.addEventListener('change', function (e) { if (e.target.name === 'pick') choose(e.target.value); });
  function hov(ev, on) {
    var g = ev.target.closest && ev.target.closest('[data-ghost],[data-row]'); if (!g) return;
    S.hover = on ? (g.getAttribute('data-ghost') || g.getAttribute('data-row')) : null; applySel();
  }
  document.addEventListener('mouseover', function (e) { hov(e, true); });
  document.addEventListener('mouseout', function (e) { hov(e, false); });
  document.addEventListener('focusin', function (e) { hov(e, true); });
  document.addEventListener('focusout', function (e) { hov(e, false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.drawer) { closeDrawer(); return; }
    var el = e.target.closest && e.target.closest('#board [data-nav]');
    if (el && /^Arrow|^Home$|^End$/.test(e.key)) {
      var els = navEls().filter(function (x) { return x.offsetParent !== null; }), i = els.indexOf(el);
      var n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : els.length - 1;
      n = Math.max(0, Math.min(els.length - 1, n)); e.preventDefault(); els[n].focus();
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target.classList && e.target.classList.contains('tab')) {
      S.activeDay = Math.max(0, Math.min(4, S.activeDay + (e.key === 'ArrowRight' ? 1 : -1))); renderBoard(); document.querySelector('.tab[aria-pressed="true"]').focus();
    }
  });

  function init() {
    analyse();
    renderTopbar(); renderStrip(); renderBoard();
    var ns = document.getElementById('nojs'); if (ns) ns.hidden = true;
    if (S.drawer) { paintDrawer(); document.body.setAttribute('data-drawer', 'open'); $('drawer').removeAttribute('inert'); } else document.body.setAttribute('data-drawer', 'closed');
    var q = location.hash;
    if (page === 'home' && q === '#clash') openDrawer({ type: 'clash' }, false);
    if (page === 'home' && q === '#tut') openDrawer({ type: 'info', id: 'c39-tut' }, false);
    if (page === 'resolve' && q === '#choose') choose('06');
    if (page === 'resolve' && q === '#hover') { S.hover = '04'; applySel(); }
    requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add('ready'); }); });
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    setTimeout(function () { if ((page !== 'home' || S.drawer) && isNarrow()) scrollToTabs(); }, 60);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
