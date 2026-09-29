/* Weekbook mockup: light vanilla JS. Everything degrades to a static page. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var live = $('#live');
  function say(t) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); } }

  /* day tabs (mobile shows one day at a time) */
  function showDay(d) {
    $$('.daytabs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.day === d)); });
    $$('.cal .day').forEach(function (s) { s.classList.toggle('is-active', s.dataset.day === d); });
  }
  $$('.daytabs button').forEach(function (b) { b.addEventListener('click', function () { showDay(b.dataset.day); }); });

  /* notice bar: in-flow, holds the preview / confirm / undo step */
  var notice = $('#notice'), nh = $('#notice-h'), np = $('#notice-p'), nok = $('#notice-ok'), nno = $('#notice-no');
  var okFn = null, noFn = null, escFn = null;
  function showNotice(o) {
    nh.textContent = o.title; np.textContent = o.text;
    nok.textContent = o.ok; nok.hidden = !o.ok; nno.textContent = o.no || ''; nno.hidden = !o.no;
    okFn = o.onOk; noFn = o.onNo; escFn = o.onEsc || o.onNo;
    notice.hidden = false;
    notice.style.animation = 'none'; void notice.offsetWidth; notice.style.animation = '';
    nh.focus({ preventScroll: true });
    notice.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    say(o.title + ' ' + o.text);
  }
  function hideNotice() { if (notice) notice.hidden = true; okFn = noFn = escFn = null; }
  if (notice) {
    nok.addEventListener('click', function () { if (okFn) okFn(); });
    nno.addEventListener('click', function () { if (noFn) noFn(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !notice.hidden && escFn) escFn(); });
  }

  /* ---------- index: clash options ---------- */
  var cbtn = $('#clash-btn'), cpanel = $('#clash-panel');
  if (cbtn && cpanel) {
    var setPanel = function (open, focusBtn) {
      cpanel.hidden = !open; cbtn.setAttribute('aria-expanded', String(open));
      if (open) { cpanel.style.animation = 'none'; void cpanel.offsetWidth; cpanel.style.animation = ''; $('#cp-h').focus({ preventScroll: true }); }
      else if (focusBtn) cbtn.focus();
    };
    cbtn.addEventListener('click', function () { setPanel(cpanel.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !cpanel.hidden) setPanel(false, true); });

    var keep = $('#keep-btn'), consKeep = $('#cons-keep'), line = $('#clashline span'), lineOld = line.textContent, wrap = $('.cal-wrap');
    keep.addEventListener('click', function () {
      var on = keep.getAttribute('aria-pressed') !== 'true';
      keep.setAttribute('aria-pressed', String(on)); keep.textContent = on ? 'Undo keep' : 'Keep it';
      consKeep.hidden = !on; wrap.classList.toggle('is-ack', on);
      $('#clashline').classList.toggle('is-kept', on);
      line.textContent = on ? 'Keeping both. They still overlap 1–2pm.' : lineOld;
      say(on ? 'Kept. ' + consKeep.textContent : 'Undone. ' + lineOld);
    });
    var drop = $('#drop-btn'), consDrop = $('#cons-drop');
    drop.addEventListener('click', function () {
      var on = consDrop.hidden; consDrop.hidden = !on; drop.setAttribute('aria-expanded', String(on));
      drop.textContent = on ? 'Hide' : 'See what changes';
    });
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = document.getElementById(btn.dataset.copy).textContent.trim();
        var label = $('span', btn), old = label.textContent;
        var done = function () { label.textContent = 'Copied'; say('Email copied. Paste it into a message to your convenor.'); setTimeout(function () { label.textContent = old; }, 2500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done); else done();
      });
    });
  }

  /* ---------- resolve: ghost slots, preview, confirm, undo ---------- */
  var cal = $('#cal'), held = $('#held'), heldBtn = $('#held-btn');
  if (cal && held && heldBtn) {
    var t0 = +cal.dataset.t0, tail = $('#held-tail'), timeEl = $('.time', held);
    var eyebrow = $('#res-eyebrow'), status = $('#res-status');
    var snap = null, preview = null, moved = false;
    var statusOld = status.textContent;

    var tabClasses = function () { return $$('.daytabs button').map(function (b) { return b.className; }); };
    var setPos = function (el, s, d, l, w) { el.style.setProperty('--s', s - t0); el.style.setProperty('--d', d); el.style.setProperty('--l', l); el.style.setProperty('--w', w); };

    var clearPreview = function (focusBtn) {
      if (!preview) return;
      var g = preview; preview = null;
      g.classList.remove('is-previewing'); $('[data-move]', g).textContent = 'Move here';
      cal.classList.remove('is-previewing'); hideNotice();
      if (focusBtn) $('[data-move]', g).focus();
    };

    heldBtn.addEventListener('click', function () {
      if (moved) return;
      var on = heldBtn.getAttribute('aria-pressed') !== 'true';
      heldBtn.setAttribute('aria-pressed', String(on));
      cal.classList.toggle('is-quiet', !on);
      if (!on) clearPreview();
    });

    $$('.ghost:not(.is-no)').forEach(function (g) {
      var mv = $('[data-move]', g);
      mv.addEventListener('click', function () {
        if (preview === g) return;
        if (preview) { preview.classList.remove('is-previewing'); $('[data-move]', preview).textContent = 'Move here'; }
        preview = g; g.classList.add('is-previewing'); mv.textContent = 'Selected';
        cal.classList.add('is-previewing');
        var extra = g.dataset.note ? ' ' + g.dataset.note + ', which is fine.' : '';
        showNotice({
          title: 'If you move: ' + g.dataset.label,
          text: 'You’d swap your Wednesday 2pm class for ' + g.dataset.swap + '.' + extra + ' Your Tuesday lecture clash is unchanged.',
          ok: 'Move to ' + g.dataset.label, no: 'Keep my time',
          onOk: function () { confirmMove(g); }, onNo: function () { clearPreview(true); }
        });
      });
    });

    var confirmMove = function (g) {
      snap = {
        held: held.getAttribute('style'), tail: tail && tail.getAttribute('style'), parent: held.parentNode,
        eyebrow: eyebrow.textContent, status: statusOld, time: timeEl.textContent, aria: heldBtn.getAttribute('aria-label'),
        tabs: tabClasses(), day: $('.day.is-active').dataset.day
      };
      var tailTxt = $('.g-tail', g).textContent.replace('Optional drop-in, ', '');
      var target = $('[data-list="' + g.dataset.day + '"]');
      target.appendChild(held);
      setPos(held, +g.dataset.s, +g.dataset.d, g.dataset.l, g.dataset.w);
      if (tail) {
        target.appendChild(tail); setPos(tail, +g.dataset.s + +g.dataset.d, 0.5, g.dataset.l, g.dataset.w);
        $('.type', tail).textContent = 'Optional drop-in, ' + tailTxt;
      }
      timeEl.textContent = g.dataset.time;
      heldBtn.setAttribute('aria-label', 'Your ' + g.dataset.label + ' COMP3900 tutorial, now.');
      held.classList.remove('is-moved'); void held.offsetWidth; held.classList.add('is-moved');
      clearPreview();
      moved = true; cal.classList.add('is-done');
      $$('.daytabs button').forEach(function (b) { b.classList.remove('has-opts'); });
      eyebrow.textContent = 'COMP3900 · Now ' + g.dataset.label;
      status.textContent = 'Done. Your tutorial is now on ' + g.dataset.swap.split(' ')[0] + '.';
      showDay(g.dataset.day);
      showNotice({
        title: 'Moved to ' + g.dataset.label + '.', text: 'Your Tuesday lecture clash is unchanged.',
        ok: 'Undo', onOk: undo, onEsc: function () { hideNotice(); heldBtn.focus(); }
      });
    };

    var undo = function () {
      if (!snap) return;
      snap.parent.appendChild(held); held.setAttribute('style', snap.held);
      if (tail) { snap.parent.appendChild(tail); tail.setAttribute('style', snap.tail); $('.type', tail).textContent = 'Optional drop-in, 3:30–4pm'; }
      timeEl.textContent = snap.time; heldBtn.setAttribute('aria-label', snap.aria);
      $$('.daytabs button').forEach(function (b, i) { b.className = snap.tabs[i]; });
      eyebrow.textContent = snap.eyebrow; status.textContent = snap.status;
      moved = false; cal.classList.remove('is-done'); showDay(snap.day);
      hideNotice(); say('Undone. Your tutorial is back at Wednesday 2pm.');
      heldBtn.focus();
    };
  }

  /* ---------- swap ---------- */
  var sst = $('#swap-status');
  if (sst && $('.rank')) {
    var seyebrow = $('#swap-eyebrow'), sold = sst.textContent, sSnap = null;
    var base = { Wed: [[10.5, '10:30am', 'COMP4020 Tutorial'], [14, '2pm', 'COMP3900 Tutorial'], [15, '3pm', 'COMP4650 Drop-in (optional)']],
                 Thu: [[11, '11am', 'COMP4020 Lecture'], [14, '2pm', 'COMP4650 Computer lab']] };
    var renderSide = function (me) {
      ['Wed', 'Thu'].forEach(function (d) {
        var list = base[d].slice();
        if (me.day === d) list.push([me.key, me.t, 'FINM1001 Tutorial', 1]);
        list.sort(function (a, b) { return a[0] - b[0]; });
        $('#side-' + d.toLowerCase()).innerHTML = list.map(function (r) {
          return '<li><time>' + r[1] + '</time><span' + (r[3] ? ' class="me"' : '') + '>' + r[2] + '</span></li>';
        }).join('');
      });
    };
    var confirmSwap = function (row, b) {
      sSnap = { eyebrow: seyebrow.textContent };
      row.classList.add('is-chosen');
      seyebrow.textContent = 'Now ' + row.dataset.when;
      sst.textContent = 'Done. You’re now in ' + row.dataset.when + '.';
      renderSide({ day: row.dataset.day, key: +row.dataset.key <= 24 ? +row.dataset.key : 17, t: row.dataset.t });
      showNotice({
        title: 'Swapped to ' + row.dataset.when + '.', text: 'Your Tuesday lecture clash is unchanged.', ok: 'Undo',
        onOk: function () {
          row.classList.remove('is-chosen'); seyebrow.textContent = sSnap.eyebrow; sst.textContent = sold;
          renderSide({ day: 'Thu', key: 9, t: '9am' }); hideNotice(); say('Undone. You are back in Thu 9–10am.'); b.focus();
        },
        onEsc: function () { hideNotice(); b.focus(); }
      });
    };
    $$('[data-swap-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var row = b.closest('.rank');
        showNotice({
          title: 'If you swap: ' + row.dataset.when,
          text: 'You’d trade Thursday 9am for ' + row.dataset.swap + '. Your Tuesday lecture clash is unchanged.',
          ok: 'Swap to ' + row.dataset.when, no: 'Keep my time',
          onOk: function () { confirmSwap(row, b); }, onNo: function () { hideNotice(); b.focus(); }
        });
      });
    });
  }
})();
