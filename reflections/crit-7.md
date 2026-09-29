# Crit 7 reflection

**What was the breakthrough that moved the work forward?**

Fixing the contracts before parallelising. With the schema, engine types and file ownership written down, workstreams did not collide, and my real MyTT data exposed what the contracts missed, so I amended them. The second breakthrough was verifying outputs myself: running things found that `pnpm test` skipped about 150 unit tests and that nothing seeded the app at boot. The redesign repeated it, and so did this round: reviewing two subagents' diffs for the swap change and week navigation caught real problems before they shipped — a confirm heading repeating its own text, a fallback reading "your your current time", a duplicated week range line. None of that showed up until I actually read the code.

**What did this work change about who I want to be as a software developer?**

I want to verify rather than delegate and hope. Directing agents moved my responsibility to reading diffs, running checks and using the product. This round I also fixed things because a marker or a student reading them literally would catch them: the README was still the course template, so I wrote a real one, and "Better than what you have" claimed more than the cards deliver, so I renamed it "Times that fit". It is not perfect: home is still above my word target now that it carries the calendar and week controls, and the recording link is disabled. I would rather say so plainly than present it as finished.
