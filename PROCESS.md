# Process overview

## What I built

A replacement for the clash handling in ANU MyTimetable, using my real Sem 2 2026 courses. Choose a tutorial and, if it clashes, the app offers other times for it or moves the other course to every option that fits. Live at https://comp4020-crit7-harkirats1511.fly.dev/. Deployment: deployed with flyctl on 2026-09-29. On the live URL I confirmed that the app seeds itself on the empty Fly volume, that a change to my timetable survives a fresh request and can be undone, that a cross-origin POST is refused with a 403, and that the live event stream and the calendar download both work.

## How I got here

**Choosing the problem.** My first thought was library study-room booking, but I had already built that in crit 2, so I did not repeat it. I chose MyTT clash handling because it is genuinely painful to use every semester. A tutorial that clashes cannot be selected until you move the class it clashes with. To find that class you read the time, check your timetable, then try each option on the other course's page one by one. The list view never shows clashes, and the grid squashes overlapping sessions into slivers. I documented this with screenshots of my own MyTT.

**Analysis and decisions.** I asked for a critical analysis beyond my own list. It found that clashes depend on which weeks sessions run, that an option can be several sessions that must move as one unit, that drop-ins are exempt from clashes, and that MyTT has no undo and never explains a clash. I then decided to use my real courses (COMP3900, COMP4020, COMP4650, FINM1001), transcribed from my screenshots. The UI serves one student but the schema is multi-student-ready. I included all four extras: auto-fix, preference scoring, what-if drafts with undo, and iCal export. The look is deliberately MyTT-like for now.

**Working method.** I acted as orchestrator only. Every code change was drafted by a dispatched Sonnet 5.5 subagent, and I never accepted one on its own report: I read diffs, re-ran the checks and drove the running app in a browser. I did read-only exploration of the starter and reviewed a written plan before any code. I fixed shared contracts before parallelising ([`be550da`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/be550da)), then ran workstreams for the engine, solver, iCal, seed, services and API, red-first spec tests, and the pages ([`be550da...3a874b6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/compare/be550da...3a874b6)).

**Corrections.**
- The first foundation agent got a column name wrong in the preferences table; the next agent regenerated the migration.
- My real data showed drop-ins bundled inside options and overflow lecture options, which the contract could not express, so I amended it ([`d37b9be`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d37b9be)).
- The solver only moved clashing groups; I sent it back for a true minimal-move solver ([`bd067df`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/bd067df)).
- `pnpm test` was silently skipping about 150 unit tests, so I had it split into unit and spec projects ([`2aa9112`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/2aa9112)).
- One spec restore needed `force=1` because it legitimately restored a clash that already existed.
- A fresh empty-database run showed nothing seeded the app at boot and the image did not ship the seed data, so it would have deployed empty ([`849e8cc`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/849e8cc)).
- Screenshots showed the grid hiding Thursday and Friday and truncating text on phones ([`8511340`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/8511340)).
- A privacy scan found a real staff ID quoted in the docs; it was replaced ([`a79d46a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/a79d46a)). I also kept my own u-number out of the repo.
- I checked the deployed app rather than trusting the local run.

I also changed the harness rule so that time and deadlines play no part in decisions, replacing an older one that let scope be cut for the clock. I edited that rule directly:

> i need you to stop taking time/deadlines into consideration while making decisions add this to the harness as well

([`d8407b2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-harkirats1511/commit/d8407b2)).

**Verification.** Typecheck has 0 errors and 264 tests pass across 21 files, including axe, one-h1-per-page, CSRF, persistence across reload, the resolve flow, iCal, seed, engine and solver. On my data the solver is fast (41 nodes) and correctly reports that my FINM1001 and COMP4650 lecture clash has no fix, since each lecture has only one time. The app says so plainly.

## UI design (to be completed)

The current look is functional but text-heavy, and the timetable page is crowded. My main complaint about MyTT is that it is built for the university, not its students. I intend a redesign session next. A critique from four angles (student-centred flows, visual density, timetable/grid interaction, copy/accessibility) has been commissioned and will be summarised here.

- Audience and user-centric reframing
- Critique findings
- Design directions considered
- Decisions
- Before/after screenshots
