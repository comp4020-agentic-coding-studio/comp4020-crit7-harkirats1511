# Crit 7 reflection

**What was the breakthrough that moved the work forward?**

Fixing the contracts before parallelising. With the schema, engine types and file ownership written down, workstreams did not collide, and my real MyTT data exposed what the contracts missed, so I amended them. The second breakthrough was verifying outputs myself: running things found that `pnpm test` skipped about 150 unit tests and that nothing seeded the app at boot. The redesign repeated it. Four critiques gave me an acceptance checklist, and driving the real flows and looking at screenshots found what green tests did not: a block failing contrast, overlapping phone labels, focus lost after a preview, and after-screenshots that showed the old UI from a stale build.

**What did this work change about who I want to be as a software developer?**

I want to verify rather than delegate and hope. Directing agents moved my responsibility to reading diffs, running checks and using the product. I also learned to treat budget as a real constraint and to change my own rules when the reason behind them changes: I kept "orchestrator only" for the build, then waived it for the redesign because dispatching and re-verifying subagents cost more than I had left, and said so in the brief. The live app is now the Daybook redesign, driven by my real timetable. It is not perfect: the home page is still above my word target once calendar labels count, swaps commit in one step, and the README is still the template. I would rather say so plainly than present it as finished.
