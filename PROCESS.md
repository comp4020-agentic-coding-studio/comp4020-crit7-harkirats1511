# Process overview

## What I built

A replacement for MyTimetable's clash handling, on my real courses: what's on this week, the one clash, what to do — with previous / this week / next navigation across 12 teaching weeks — and either change a class (preview-confirm-undo) or swap to a fitting time. Live at https://comp4020-crit7-harkirats1511.fly.dev/, README at `/readme/`. On the live URL I confirmed self-seeding, select then undo persisting across fresh requests, a 403 for cross-origin POST, the event stream and the calendar download.

## How I got here

**Problem.** Library room booking was my first thought, but I built that in crit 2. MyTT clash handling is painful every semester: a clashing tutorial can't be selected until you move the class it clashes with.

**Analysis and decisions.** A critical analysis found clashes depend on session weeks, options can span several moving sessions, drop-ins are exempt, and MyTT never explains a clash or offers undo. I chose real courses (COMP3900, COMP4020, COMP4650, FINM1001), a multi-student schema, single-student UI, and four extras: auto-fix, scoring, drafts, iCal export.

**Method.** I acted as orchestrator only: every change came from a Sonnet 5.5 subagent, never accepted on report — I read diffs, re-ran checks, drove the app myself. I fixed shared contracts before parallelising ([`3348832`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/3348832)), then ran workstreams: engine, solver, iCal, seed, services, tests, pages ([`3348832...8b9c881`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/3348832...8b9c881)).

**Corrections.**
- A preferences column name was wrong; the next agent regenerated the migration.
- Real data showed drop-ins inside options and overflow lectures, so I amended the contract ([`d44e6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d44e6b0)).
- The solver only moved clashing groups; I sent it back for a minimal-move solver ([`fd5d12e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/fd5d12e)).
- `pnpm test` silently skipped ~150 tests; I split unit and spec projects ([`e3eb230`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e3eb230)).
- A fresh empty database showed nothing seeded the app at boot ([`15bd4c0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/15bd4c0)).
- Screenshots showed the grid hiding Thursday/Friday on phones ([`e11821d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e11821d)).
- A privacy scan found a real staff ID in the docs ([`ea287ac`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/ea287ac)); I kept my u-number out too.

I edited the harness rule so time and deadlines play no part in decisions ([`c431287`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/c431287)):

> i need you to stop taking time/deadlines into consideration while making decisions add this to the harness as well

Typecheck: 0 errors, 343 tests pass. The solver reports my FINM1001/COMP4650 clash has no fix — each lecture has one time.

## UI design

The app didn't satisfy me: text-heavy, built for the university, not students. Four critiques agreed: no "this week" view, a ~1000-word resolve page, hover-only details, small tap targets. Agents built four mockups from my data; checking caught a mislabelled scenario and two error screenshots ([`47d7405`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/47d7405)).

**Implementation.** I chose Daybook and wrote a brief with a checklist ([`a2a0293`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/a2a0293)). Budget was tight — three quarters gone — so I waived the subagent-only rule; one session (Claude Opus 5.5, personal plan) wrote the code directly ([`9fcdd63...caeda8e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/9fcdd63...caeda8e)). The API addition restores a discarded draft, so Discard has undo ([`9fcdd63`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/9fcdd63)).

How the checklist is met:
- Student-centred: home leads with my day and one problem card; 12-hour times, real room names, "weeks 2–12", overflow hidden, P1/P2 merged, reasons from the engine ([`8f579b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/8f579b5)).
- Not texty: home had 166 words, 81 outside the calendar; Change a class 63–94; at most three bordered surfaces.
- Fixes: preview-confirm, keep-the-clash link, Drop/Discard behind confirm+Undo, 44px targets, focus on result, favicon, reduced motion ([`dff4840`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/dff4840)).
- Accessibility/mobile: axe clean on 13 states at 1300/390/320px, no sideways scroll; phone sheet is a dialog with Escape/focus return.

**Verification.** A script drove real flows on a fresh database (select, refusal, move, undo, drop, discard, no-JS); screenshots found what tests missed: failed contrast, overlapping labels, a tripled message, lost focus after Preview ([`731a0a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/731a0a8), [`caeda8e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/caeda8e)). First after-screenshots showed the old UI; I retook them.

**Next round.** I replaced the template README with a real one — the app, the problem, the three views, what "good" means, run/test, limits — at `/readme/` ([`76d97c6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/76d97c6)). "Better than what you have" became "Times that fit": cards are ranked fits, not always better ([`12ce8d4`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/12ce8d4)). Swap is now two-step like Change a class: Choose opens a confirm card ("If you move: you'd swap your Thu 9-10am for Thu 5-6pm"), then Move; the Undo toast takes focus and works without JavaScript ([`e00107b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e00107b)). My week gained previous / this week / next links with `?week=`, clamped to 12 teaching weeks, the break named by weeks 6–7, this week marked, with unit tests for `parseWeek` and `weekNav` ([`e884dde`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e884dde)).

For these follow-ups I asked for Sonnet subagents again: two drafted the swap change and week navigation in parallel, each owning separate files. Review sent back three fixes: a confirm heading repeating itself, a fallback reading "your your current time", and a duplicated week range line. I verified with `pnpm check` (348 tests), axe at 1300/390/320px (clean on `/`, weeks 7 and 9, the swap page, its confirm state, `/readme/`), and a scripted run of choose-confirm-undo and week stepping with/without JS; each commit checked green in isolation.

**Current state.** The live app is the redesign. Before/after screenshots are in `docs/design/before/` and `docs/design/after/` ([`1c914f0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/1c914f0)), clock pinned to Tuesday 11:40. Still imperfect: home is about 175 visible words including calendar and week controls, above the 150-word target; "Watch the recording" is disabled, no recordings linked.
