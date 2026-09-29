// Daybook progressive enhancement. Every page works without this: day chips are links, previews are links, commits
// are form POSTs. This adds the in-place day switch (sliding pill), focus on the result after a POST redirect, the
// copy-email button, the bottom sheet with dialog semantics on small screens, and hover sync between rows and ghosts.
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- result toast: float it, move focus to it (not <body>), let it be dismissed ----------
function toastInit() {
  const t = $("[data-result]");
  if (!t) return;
  if (!t.classList.contains("err")) t.classList.add("float");
  const x = $<HTMLButtonElement>("[data-dismiss]", t);
  if (x) {
    x.hidden = false;
    x.addEventListener("click", () => t.classList.add("gone"));
  }
  t.addEventListener("keydown", (e) => {
    if (e.key === "Escape") t.classList.add("gone");
  });
  t.focus({ preventScroll: true });
  // Anchor the changed class: bring the "Now" block of the visible day into view.
  const mine = $(".g-tl:not([hidden]) .ev.mine");
  if (mine) mine.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
}

/** A client-side status message (copy results) in the same toast style. */
function say(text: string) {
  let t = $("#say");
  if (!t) {
    t = document.createElement("div");
    t.id = "say";
    t.className = "toast float";
    t.setAttribute("role", "status");
    t.innerHTML = '<svg class="ck i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><p></p>';
    document.body.appendChild(t);
  }
  t.classList.remove("gone", "float");
  void t.offsetWidth;
  t.classList.add("float");
  $("p", t)!.textContent = text;
  window.clearTimeout(Number(t.dataset.timer));
  t.dataset.timer = String(window.setTimeout(() => t!.classList.add("gone"), 6000));
}

// ---------- day strip: switch panels in place, slide the pill ----------
function stripInit() {
  const strip = $("[data-strip]");
  const panels = $$("[data-day-panel]");
  if (!strip || panels.length === 0) return;
  const pill = document.createElement("span");
  pill.className = "strip-pill";
  pill.setAttribute("aria-hidden", "true");
  strip.prepend(pill);
  strip.classList.add("has-pill");
  const days = $$<HTMLAnchorElement>(".day", strip);
  const place = (instant: boolean) => {
    const sel = days.find((d) => d.getAttribute("aria-current") === "true");
    if (!sel) return;
    if (instant) pill.style.transition = "none";
    pill.style.width = `${sel.offsetWidth}px`;
    pill.style.transform = `translateX(${sel.offsetLeft}px)`;
    if (instant) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  };
  const select = (day: string, href: string) => {
    const panel = panels.find((p) => p.dataset.dayPanel === day);
    if (!panel) return false;
    for (const a of [...days, ...$$(".mday")]) {
      if (a.dataset.day === day) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    for (const p of panels) p.hidden = p !== panel;
    place(false);
    const u = new URL(href, location.href);
    u.hash = "";
    history.replaceState(null, "", u.pathname + u.search);
    return true;
  };
  document.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>(".day[data-day], .mday[data-day]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (select(a.dataset.day!, a.href)) {
      e.preventDefault();
      if (a.classList.contains("mday")) days.find((d) => d.dataset.day === a.dataset.day)?.focus();
    }
  });
  window.addEventListener("resize", () => place(true));
  document.fonts?.ready.then(() => place(true));
  place(true);
}

// ---------- copy the convenor email ----------
function copyInit() {
  for (const b of $$<HTMLButtonElement>("[data-copy]")) {
    b.hidden = false;
    b.addEventListener("click", async () => {
      const text = document.getElementById(b.dataset.copy!)?.textContent?.trim() ?? "";
      const done = () => say("Email copied. Paste it into a new message.");
      try {
        await navigator.clipboard.writeText(text);
        done();
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) done();
        else say("Copy didn’t work. Select the note and copy it by hand.");
      }
    });
  }
}

// ---------- "Other times" as a bottom sheet on small screens ----------
function sheetInit() {
  const panel = $("#panel.sheet");
  const bar = panel && $<HTMLButtonElement>(".sheet-bar", panel);
  if (!panel || !bar) return;
  const mq = window.matchMedia("(max-width: 899px)");
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  scrim.hidden = true;
  panel.before(scrim);
  const outside = [$(".top"), $(".main"), $(".skip"), $("#confirm"), $(".draft-banner")].filter(Boolean) as HTMLElement[];
  const set = (state: "peek" | "open", focus = true) => {
    const open = state === "open" && mq.matches;
    panel.dataset.state = mq.matches ? state : "open";
    bar.hidden = !mq.matches;
    bar.setAttribute("aria-expanded", String(open || !mq.matches));
    if (open) {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
    } else {
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
    }
    scrim.hidden = !open;
    for (const el of outside) el.toggleAttribute("inert", open);
    if (open && focus) $("#panel-h", panel)?.focus({ preventScroll: true });
  };
  const close = () => {
    set("peek");
    bar.focus();
  };
  bar.addEventListener("click", () => (panel.dataset.state === "open" ? close() : set("open")));
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.getAttribute("role") === "dialog") close();
  });
  mq.addEventListener("change", () => set("peek", false));
  set("peek", false);
}

// ---------- hover sync: a row and its ghost light up together ----------
function hoverInit() {
  const on = (e: Event, v: boolean) => {
    const t = (e.target as Element).closest?.("[data-oid]") as HTMLElement | null;
    if (!t) return;
    for (const n of $$(`[data-oid="${CSS.escape(t.dataset.oid!)}"]`)) n.classList.toggle("hl-on", v);
  };
  document.addEventListener("mouseover", (e) => on(e, true));
  document.addEventListener("mouseout", (e) => on(e, false));
}

// ---------- the More menu closes on Escape and outside clicks ----------
function menuInit() {
  const d = $<HTMLDetailsElement>("[data-navmore]");
  if (!d) return;
  document.addEventListener("click", (e) => {
    if (d.open && !d.contains(e.target as Node)) d.open = false;
  });
  d.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && d.open) {
      d.open = false;
      $("summary", d)?.focus();
    }
  });
}

// ---------- after following a Preview / "See my day" link, focus lands on its heading ----------
// The links point at the heading itself (#cf-h, #pv-title, tabindex=-1), so the browser focuses it natively; this
// re-applies focus after the browser's own fragment scroll, which can otherwise leave focus on <body>.
function hashFocus() {
  const id = location.hash.slice(1);
  if (!["cf-h", "pv-title"].includes(id) || $("[data-result]")) return;
  window.addEventListener("load", () => setTimeout(() => document.getElementById(id)?.focus(), 0), { once: true });
}

toastInit();
stripInit();
copyInit();
sheetInit();
hoverInit();
menuInit();
hashFocus();
