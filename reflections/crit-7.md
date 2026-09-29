# Crit 7 reflection

**What was the breakthrough that moved the work forward?**

Fixing the contracts before parallelising. Once the schema, engine types and file ownership were written down, workstreams could run without colliding. The contracts were not perfect: my real MyTT data showed drop-ins inside options and overflow lecture options, so I amended them. Grounding the design in my own screenshots and courses caught things a guess would have missed. The other breakthrough was refusing to trust agent reports. Running things myself found that `pnpm test` skipped about 150 unit tests, that nothing seeded the app at boot, and that the grid hid Thursday and Friday. Each would have looked fine in a report and been wrong in use.

**What did this work change about who I want to be as a software developer?**

I want to be the person who verifies rather than the person who delegates and hopes. Directing agents did not remove my responsibility for the result; it moved it to reading diffs, running the checks and using the product. I also learned to name a wrong decision plainly and change the harness, as I did when I removed time and deadlines from the decision rules. Not everything went right: the UI is still text-heavy and the timetable page is crowded. I would rather say so and redesign it than present it as finished.
