# Process overview

## What I built

A replacement for the clash handling in ANU MyTimetable, using my real Sem 2 2026 courses. It opens on my week: what is on, the one thing that clashes and what I can do about it. From there I can change a class (every other time drawn on my day, with the reason when it does not fit, preview then confirm, undo) or swap to a ranked better time. Live at https://comp4020-crit7-harkirats1511.fly.dev/, redeployed with flyctl on 2026-09-30. On the live URL I confirmed self-seeding, a select then undo persisting across fresh requests, a 403 for cross-origin POST, the event stream and the calendar download.

## How I got here

**Problem.** Library room booking was my first thought, but I built that in crit 2. I chose MyTT clash handling because it is painful every semester: a clashing tutorial cannot be selected until you move the class it clashes with, and finding that class means reading times, checking your timetable, then trying each option on the other course one by one. I recorded it with screenshots of my own MyTT.

**Analysis and decisions.** I asked for a critical analysis beyond my list. It found that clashes depend on which weeks sessions run, that an option can be several sessions moving as one unit, that drop-ins are exempt, and that MyTT has no undo and never explains a clash. I decided on my real courses (COMP3900, COMP4020, COMP4650, FINM1001), a multi-student-ready schema behind a single-student UI, and four extras: auto-fix, preference scoring, what-if drafts and iCal export.

**Method.** For the build I acted as orchestrator only. Every code change was drafted by a dispatched Sonnet 5.5 subagent and never accepted on its report: I read diffs, re-ran checks and drove the app in a browser. I approved a written plan before any code, fixed shared contracts before parallelising ([`be550da`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/be550da)), then ran workstreams for engine, solver, iCal, seed, services, red-first spec tests and pages ([`be550da...3a874b6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/be550da...3a874b6)).

**Corrections.**
- A preferences column name was wrong; the next agent regenerated the migration.
- My real data showed drop-ins inside options and overflow lectures, so I amended the contract ([`d37b9be`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d37b9be)).
- The solver only moved clashing groups; I sent it back for a true minimal-move solver ([`bd067df`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/bd067df)).
- `pnpm test` silently skipped about 150 unit tests; I had it split into unit and spec projects ([`2aa9112`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/2aa9112)).
- A fresh empty-database run showed nothing seeded the app at boot ([`849e8cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/849e8cc)).
- Screenshots showed the grid hiding Thursday and Friday on phones ([`8511340`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/8511340)).
- A privacy scan found a real staff ID in the docs ([`a79d46a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/a79d46a)); I also kept my u-number out of the repo.

I edited the harness rule directly so that time and deadlines play no part in decisions ([`d8407b2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d8407b2)):

> i need you to stop taking time/deadlines into consideration while making decisions add this to the harness as well

Typecheck has 0 errors and 343 tests pass across 22 files. On my data the solver correctly reports that my FINM1001 and COMP4650 lecture clash has no fix, since each lecture has one time.

## UI design

The working app did not satisfy me: it was text-heavy and, like MyTT, built for the university rather than its students. Four critiques (student-centred flows, visual density, timetable interaction, copy and accessibility) agreed: no "what's on this week" view, a resolve page of about 1000 words, hover-only details and small tap targets. Agents built four static mockups from my real data; checking caught a mislabelled scenario, ghost slots missing drop-in tails and two screenshots that were browser error pages ([`7c51d35`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/7c51d35)).

**Implementation.** I chose Daybook and wrote a brief with an acceptance checklist taken from the critiques ([`463ddd1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/463ddd1)). Budget was a real constraint: about three quarters of my weekly allowance had gone, so I waived the subagent-only rule for this step, because dispatching and re-verifying agents costs more, and one session (Claude Opus 5.5, on my personal plan) wrote the code directly ([`6c69502...a009a53`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/6c69502...a009a53)). The engine and schema are unchanged; the one API addition is restoring a discarded draft, so Discard has an undo ([`6c69502`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/6c69502)).

How the checklist is met:
- Student-centred: the home page leads with my day and one problem card; 12-hour times, "Fulton Muir 2.03", "weeks 2–12", overflow clones hidden, P1/P2 merged, and reasons come from the engine. Unit tests pin these to my data ([`2466576`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/2466576)).
- Not texty: home has 166 visible words, 81 outside the calendar; Change a class has 63–94 besides the calendar; at most three bordered surfaces.
- Fixes: preview then confirm, keep-the-clash as a quiet link, Drop and Discard behind a confirm with Undo, 44px targets, focus on the result after a POST, favicon, `theme-color`, reduced motion ([`7af0396`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/7af0396)).
- Accessibility and mobile: axe (full rules, contrast measured in real Chrome) is clean on 13 page states at 1300, 390 and 320px with no sideways scroll; the phone sheet is a dialog with Escape and focus return.

**Verification.** A script drove the real flows on a fresh database (select, clash refusal, move, undo, drop, discard, no-JS) and looking at screenshots found problems the tests missed: a faded block failing contrast, overlapping phone nav labels, "can't move" said three times, focus left on the page after Preview, four bordered surfaces ([`5842ab5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/5842ab5), [`a009a53`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/a009a53)). My first after-screenshots showed the old UI from a stale build; I caught it by looking and retook them.

**Current state.** The live app is the redesign. Before and after screenshots are in `docs/design/before/` and `docs/design/after/` ([`77b6ff3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/77b6ff3)), taken with the clock pinned to Tuesday 11:40 so the clash day shows. Still imperfect: home is above the 150-word target once calendar labels count, Swap commits in one step (with Undo), "Watch the recording" is disabled because no recordings are linked, and `README.md` is still the template.
