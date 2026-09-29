# Process overview

## What I built

A replacement for MyTimetable's clash handling on my real Sem 2 2026 courses: what's on this week, the one clash and what to do about it, previous/this week/next navigation across the 12 teaching weeks, then change a class (preview, confirm, undo) or swap to a fitting time. Live at https://comp4020-crit7-harkirats1511.fly.dev/, README at `/readme/`. On the live URL I confirmed it seeds itself, a change survives fresh requests and undoes, a cross-origin POST gets 403, and the event stream and calendar download work.

## How I got here

**Problem.** Library room booking was my first idea, but I built that in crit 2. MyTimetable's clash handling is painful every semester: a clashing tutorial can't be chosen until you find and move the class it clashes with.

**Analysis and decisions.** A critical analysis found that clashes depend on which weeks sessions run, an option can be several sessions that move together, drop-ins are exempt, and MyTimetable never explains a clash or offers undo. I chose my real courses (COMP3900, COMP4020, COMP4650, FINM1001), a multi-student schema behind a single-student UI, and four extras: auto-fix, preference scoring, drafts, iCal export.

**Method.** I acted as orchestrator: a Sonnet 5.5 subagent drafted every code change and none was accepted on its own report; I read diffs, re-ran checks and used the app. I fixed shared contracts before parallelising ([`3348832`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/3348832)), then ran workstreams for engine, solver, iCal, seed, services, tests and pages ([`3348832...8b9c881`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/3348832...8b9c881)).

**Corrections.**
- A preferences column name was wrong; the next agent regenerated the migration.
- Real data showed drop-ins inside options and overflow lectures; I amended the contract ([`d44e6b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d44e6b0)).
- The solver only moved clashing groups; I sent it back for a minimal-move solver ([`fd5d12e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/fd5d12e)).
- `pnpm test` silently skipped about 150 tests; I split unit and spec projects ([`e3eb230`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e3eb230)).
- A fresh empty database showed nothing seeded the app at boot ([`15bd4c0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/15bd4c0)).
- Screenshots showed the grid hiding Thursday and Friday on phones ([`e11821d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e11821d)).
- A privacy scan found a staff ID in the docs ([`ea287ac`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/ea287ac)); I kept my u-number out too.

I changed the harness so time and deadlines play no part in decisions ([`c431287`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/c431287)):

> i need you to stop taking time/deadlines into consideration while making decisions add this to the harness as well

Typecheck has 0 errors and 348 tests pass. The solver reports my FINM1001/COMP4650 clash has no fix: each lecture has one time.

## UI design

The app was text-heavy and built for the university, not students. Four critiques agreed: no "this week" view, a ~1000-word resolve page, hover-only details, small tap targets. Agents built four mockups from my data; checking caught a mislabelled scenario and two error screenshots ([`47d7405`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/47d7405)).

**Implementation.** I chose Daybook and wrote a checklist brief ([`a2a0293`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/a2a0293)). With three quarters of my budget gone I waived the subagent-only rule, and one session on my personal plan wrote the code directly ([`9fcdd63...caeda8e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/9fcdd63...caeda8e)); it also added restoring a discarded draft, so Discard has undo ([`9fcdd63`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/9fcdd63)). Against the checklist:
- Student-centred: home leads with my day and one problem card; 12-hour times, real room names, "weeks 2–12", overflow hidden, P1/P2 merged, reasons from the engine ([`8f579b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/8f579b5)).
- Fixes: preview-confirm, keep-the-clash as a quiet link, Drop/Discard behind confirm and Undo, 44px targets, focus on the result, favicon, reduced motion ([`dff4840`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/dff4840)).
- Accessibility/mobile: axe clean on 13 states at 1300/390/320px with no sideways scroll; the phone sheet is a dialog with Escape and focus return.

**Verification.** A script drove real flows on a fresh database (select, refusal, move, undo, drop, discard, no-JS). Screenshots found what tests missed: failed contrast, overlapping labels, a tripled message, lost focus after Preview ([`731a0a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/731a0a8), [`caeda8e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/caeda8e)). My first after-screenshots showed the old UI; I retook them.

**Next round.** I replaced the template README with a real one ([`76d97c6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/76d97c6)) and renamed "Better than what you have" to "Times that fit", since the cards are ranked fits, not always better ([`12ce8d4`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/12ce8d4)). Swap is now two-step like Change a class: Choose opens "If you move: you'd swap your Thu 9-10am for Thu 5-6pm", then Move, with Undo taking focus and no JavaScript needed ([`e00107b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e00107b)). My week gained previous/this week/next links via `?week=`, clamped to 12 weeks, the break named, with unit tests ([`e884dde`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/e884dde)). Two Sonnet subagents drafted swap and week navigation in parallel; my review sent back three fixes (a repeated heading, "your your current time", a duplicated week range). I verified with `pnpm check`, axe at three widths, and a scripted choose-confirm-undo run with and without JavaScript.

**Last fixes.** "Watch the recording" was a disabled placeholder; it now opens Echo360's sign-in in a new tab, and the convenor email sits one click away beside it ([`ebd879d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/ebd879d)).

**Current state.** The live app is the redesign, with before/after screenshots in `docs/design/` ([`1c914f0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/1c914f0)). Measured in a browser on the busiest day, home shows about 190 visible words, over my 150 target: it carries the day strip, timeline, week glance and problem card, and cutting further would remove features.
