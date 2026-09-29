# Crit 7 reflection

**What was the breakthrough that moved the work forward?**

Fixing the contracts before parallelising. With the schema, engine types and file ownership written down, workstreams did not collide, and my real MyTT data exposed what the contracts missed (drop-ins inside options, overflow lectures), so I amended them. The second breakthrough was verifying outputs myself: running things found that `pnpm test` skipped about 150 unit tests and that nothing seeded the app at boot. The design round repeated it. Asking for critiques from four angles found problems I would have missed, and looking at outputs caught a broken screenshot, a mislabelled scenario and a wrong critique claim.

**What did this work change about who I want to be as a software developer?**

I want to verify rather than delegate and hope. Directing agents moved my responsibility to reading diffs, running checks and using the product. I also want to treat a limited budget as a real constraint: I chose to put what remained into the evidence and deployment before more building. Not everything is done. The redesign is prototyped as four directions but not implemented, so the live app is still the text-heavy first build. I would rather say so plainly than present it as finished.
