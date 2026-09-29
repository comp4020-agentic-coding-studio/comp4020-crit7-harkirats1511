# Process overview

## What I built

A replacement for the clash handling in ANU MyTimetable, using my real Sem 2 2026 courses. Choose a tutorial and, if it clashes, the app offers other times for it or moves the other course to every option that fits. Live at https://comp4020-crit7-harkirats1511.fly.dev/. Deployed with flyctl on 2026-09-29. On the live URL I confirmed self-seeding, persistence with undo, a 403 for cross-origin POST, the event stream and the calendar download.

## How I got here

**Problem.** Library room booking was my first thought, but I built that in crit 2. I chose MyTT clash handling because it is painful every semester: a clashing tutorial cannot be selected until you move the class it clashes with, and finding that class means reading times, checking your timetable, then trying each option on the other course one by one. The list view never shows clashes and the grid squashes overlaps into slivers. I recorded it with screenshots of my own MyTT.

**Analysis and decisions.** I asked for a critical analysis beyond my list. It found that clashes depend on which weeks sessions run, that an option can be several sessions moving as one unit, that drop-ins are exempt, and that MyTT has no undo and never explains a clash. I decided on my real courses (COMP3900, COMP4020, COMP4650, FINM1001), transcribed from my screenshots, a multi-student-ready schema behind a single-student UI, and all four extras: auto-fix, preference scoring, what-if drafts with undo, and iCal export.

**Method.** I acted as orchestrator only. Every code change was drafted by a dispatched Sonnet 5.5 subagent and never accepted on its report: I read diffs, re-ran checks and drove the app in a browser. I explored the starter read-only and approved a written plan before any code, fixed shared contracts before parallelising ([`be550da`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/be550da)), then ran workstreams for engine, solver, iCal, seed, services, red-first spec tests and pages ([`be550da...3a874b6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/be550da...3a874b6)).

**Corrections.**
- The first foundation agent got a preferences column name wrong; the next regenerated the migration.
- My real data showed drop-ins inside options and overflow lecture options, so I amended the contract ([`d37b9be`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d37b9be)).
- The solver only moved clashing groups; I sent it back for a true minimal-move solver ([`bd067df`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/bd067df)).
- `pnpm test` silently skipped about 150 unit tests; I had it split into unit and spec projects ([`2aa9112`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/2aa9112)).
- One spec restore needed `force=1` because it legitimately restored a clash that already existed.
- A fresh empty-database run showed nothing seeded the app at boot and the image lacked the seed data ([`849e8cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/849e8cc)).
- Screenshots showed the grid hiding Thursday and Friday and truncating text on phones ([`8511340`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/8511340)).
- A privacy scan found a real staff ID in the docs; it was replaced ([`a79d46a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/a79d46a)). I also kept my own u-number out of the repo, and I checked the deployed app rather than trusting the local run.

I edited the harness rule directly so that time and deadlines play no part in decisions, replacing one that allowed cutting scope for the clock ([`d8407b2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d8407b2)):

> i need you to stop taking time/deadlines into consideration while making decisions add this to the harness as well

Typecheck has 0 errors and 264 tests pass across 21 files. On my data the solver (41 nodes) correctly reports that my FINM1001 and COMP4650 lecture clash has no fix, since each lecture has one time.

## UI design

The working app did not satisfy me: it is text-heavy, the timetable page is crowded, and my main complaint about MyTT is that it is built for the university rather than its students. Four independent critiques (student-centred flows, visual density, timetable and resolve interaction, copy and accessibility) agreed the app repeats it: no "what's on this week" view, a resolve page of about 1000 words and 3400px, hover-only details and small tap targets.

I installed design skills (taste-skill, Vercel's web-design-guidelines, a subset of awesome-design-skills, the Playwright CLI), reading their sources first. They were not registered in the running session, so agents read the SKILL.md files directly; the guidelines came back condensed, so I treated them as a checklist. The web-design-guidelines code review gave about 38 findings (about 24 quick wins); the worst were keyboard-unreachable grid blocks, one-click Drop/Discard and small touch targets. The separate redesign audit added a grid time axis starting at 10:00 at about 168px per hour (so the first screen was mostly empty rows), each clash shown three times, ten green OK chips, "0 left of 1" seat meters everywhere, raw underscores in room names and a seven-item nav.

Agents then built four static mockups from my real data, without copying a reference dashboard I liked: Weekbook (noticeboard), Margin (calm paper), Daybook (day-by-day) and Night Shift (dark, grid-first). After critique and refinement all pass axe at 1300px and 390px. Checking caught real problems: "Fix a clash" labelled a page for a clash no tutorial move can fix, so it became "Change your Wednesday tutorial"; ghost slots omitted drop-in tails; "Moved. No clash." overclaimed; one click committed a move (now preview then confirm). I discounted one critique claim that my own screenshot contradicted, and found two Night Shift screenshots were browser error pages by looking at them, then re-swept all 52.

Current state: the live app is the functional first build, not redesigned. The directions are prototypes in `docs/design/options/`, with before screenshots in `docs/design/before/` ([`7c51d35`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/7c51d35)). I lean towards Weekbook but have not implemented it. About three quarters of my weekly budget was used, so I put what remained into this account, the reflection, deployment and a final check first.
