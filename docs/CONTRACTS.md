# Parallel workstream contracts

Foundation has landed. Every file below already exists as a stub with its FINAL signature; implement the
stubs in place, do not change signatures. **Only one workstream may touch a file.** Never edit
`src/lib/engine/types.ts`, `src/lib/schema.ts` or `drizzle/` (foundation only; a schema change needs the
orchestrator and `pnpm db:generate` run serially, which needs a TTY for rename prompts: answer "create table").
Engine files are pure TS: no DB or Astro imports. Do not `git commit`.

Shared vocabulary (`src/lib/engine/types.ts`): `WeekMask` = bitmask over teaching weeks 1..13, bit (i-1) = week i.
Days 0 = Monday. Times are minutes since midnight. `Allocation` = Map groupId -> optionId. Seats used =
COUNT(allocations), never stored. `capacity: null` = "Not published", never zero or full. Multi-part options
are atomic; exempt sessions never clash either way (session exempt = `session.exempt || group.exemptFromClash`).
The real term has 12 teaching weeks, break after week 6, week 1 Monday = 2026-07-27 (masks stay 1..13 bits).

## A. Engine core
Owns: `src/lib/engine/{weeks,clash,resolve,draft}.ts` and `src/lib/engine/{weeks,clash,resolve,draft}.test.ts`.
Implements: `parseWeeks, formatWeeks, weekList, weeksOverlap, weekBit, weekToDate`; `sessionOverlap, optionClash,
clashesFor, allClashes, optionStates`; `resolveClash`; `effectiveAlloc, diffAlloc`. Signatures are in those files.
Rules: a session pair is skipped when EITHER session is exempt (`session.exempt || group.exemptFromClash`); drop-ins are bundled
inside options (COMP3900 TutA, COMP4650 ComA), so the option's other session still clashes. Tests must explain this.
Same slot on disjoint weeks does not clash; adjacent (end == start) does not clash; cascade-safe candidates.

## B. Solver + prefs
Owns: `src/lib/engine/{solve,prefs}.ts` + tests. Implements `autofix`, `defaultPrefs, parsePrefs, scorePrefs`.
May import from A's modules (clash/resolve) by their stub signatures.

## C. iCal
Owns: `src/lib/engine/ical.ts` + `ical.test.ts`, and `spec/ics.test.ts`. Implements `buildIcs`.

## D. Seed
Owns: `src/lib/seed/{schema,validate,load}.ts`, `scripts/seed.ts`, `seed/*.json`, the seed hand-fill guide.
Implements `validateSeed` (`path: message` errors, TODO allowed unless strict), `seedIfEmpty(opts?)`, and the
`db:seed` script (`--strict`). Zod types in `seed/schema.ts` are the contract; extend only additively.
- `seedIfEmpty()` is IDEMPOTENT (no-op when `terms` is non-empty) and safe on every boot. `spec/global-setup.ts`
  (owned by E, see below) will call it, after setting `process.env.DATABASE_PATH` to the temp DB and before
  spawning the app, so it must not depend on Astro and must use `src/lib/db.ts` (migrate-on-import).
- Seed student id is `"me"` (`DEFAULT_STUDENT_ID`); `enrolled` inserts placeholder students so seats match MyTT.
- COMP4020 TutA (`comp4020-tuta`) has options `01`..`06`. Options 01 and 02 are multi-part (P1 and P2 sessions).
  Per the MyTT screenshot, option 03 is Wed 09:00 and option 04 is Wed 10:30 (04 is NOT Wed 09:00). The student's
  allocated option in the seed is decided from the screenshot, not assumed. Course routes use the code, so
  `/course/COMP4020/` must resolve (match by code case-insensitively, or id `comp4020`).
- Weeks input: accept teaching-week strings ("1-8,10-12") AND MyTT raw date-range strings ("27/7-31/8, 21/9-28/9,
  12/10-26/10") via a tested converter to teaching-week masks (term startDate/break). Seed sessions use `dropIn`, options `overflow`.
- Capacity = MyTT Free (+1 for the option the student is allocated to, since Free excludes their own seat); see
  /home/harki/.claude/jobs/26fc8fcc/tmp/mytt-data.md.
- Student row: display name only (no u-number, no email). Raw staff IDs like u8204149 are stored as unknown (null).
- Real term: startDate 2026-07-27, teachingWeeks 12, breakAfterWeek 6.
- Real activity lists for COMP3900, COMP4650, FINM1001 come from the student; use `TODO` markers meanwhile.

## E. Services + API
Owns: `src/lib/services/*`, `src/pages/api/**` (including `api/events.ts`, which must keep streaming bytes and
emit `alloc-changed` via `src/lib/events.ts`), and `spec/global-setup.ts` (add the `seedIfEmpty()` call).
Implements every function in `src/lib/services/alloc.ts`: `loadCatalog, loadAllocation, seatsUsed, loadHistory,
getOpenDraft, loadDraftOverlay, loadPrefs, loadWaitlist, loadSwapRequests, selectOption, dropGroup, moveBatch,
joinWaitlist, requestSwap, newDraft, applyDraft, discardDraft, undoLatest, autofixPreview, autofixConfirm,
savePrefs`. One `BEGIN IMMEDIATE` per mutation via `client` from `src/lib/db.ts`, seats re-checked inside it,
history written, event emitted after commit. Only E (and foundation) may run `pnpm db:generate`.
Endpoints (all stubs return 501 `{error:"not implemented"}` now): form POSTs, all answering 303 and working without JS:
`/api/select /api/drop /api/move /api/waitlist /api/swap /api/draft/new /api/draft/apply /api/draft/discard
/api/undo /api/autofix /api/prefs`; plus `GET /api/timetable.ics` and `GET /api/state.json`.
Each stub file names its expected form fields in a comment. Keep `POST /` on `src/pages/index.astro` untouched.

## F. Shell, dashboard, options
Owns: `src/layouts/Shell.astro`, `src/styles/shell.css`, `src/pages/index.astro` (keep SSR and the same-origin POST
handler that 303s), `src/pages/timetable/index.astro`, `src/pages/course/[id].astro`, `src/pages/readme.astro`
(only to adapt to Shell), and new components `src/components/{StateChip,SeatsMeter,WeeksLabel,OptionsTable,ResolvePanel,Sidebar,ActionItems}.astro`.
Shell must keep: `lang="en-AU"`, `title` prop, viewport meta, `<nav aria-label="site">`, `<main>` around the slot,
and it imports `shell.css` and `grid.css`. Each page supplies its single `<h1>`. Every page in `spec/routes.ts` must stay
green in the invariants (F also owns `spec/routes.ts`; other workstreams ask F or the orchestrator to add a route).

F also shows `option.overflow` options (e.g. "01_Clone") as "overflow / virtual".

## G. Grid
Owns: `src/pages/grid/index.astro`, `src/styles/grid.css`, components `src/components/{GridDay,WeekScrubber}.astro`.
Query params `?focus=<groupId>&week=<n>`.

## H. Secondary pages
Owns: `src/pages/{draft,history,auto-fix,preferences}/index.astro`, components `src/components/{HistoryList,DraftBanner}.astro`.

## Foundation-owned (do not edit)
`src/lib/engine/types.ts`, `src/lib/schema.ts`, `drizzle/**`, `src/lib/db.ts`, `src/lib/events.ts`, `docs/CONTRACTS.md`, `package.json` (ask orchestrator to add dependencies).
