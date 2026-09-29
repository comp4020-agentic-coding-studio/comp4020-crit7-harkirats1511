# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the starter is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec. Read them before you plan or build;
what the agent needs to carry from any of it is your call.

## How to work in here

Carried forward from earlier prototypes --- rules that held up across more than
one build, not tied to any one week's content or framework.

- Time and deadlines play no part in any decision here. Never recommend,
  cut, shrink or reorder scope because of the clock, the cutoff or "how long
  it will take", and don't mention time remaining when weighing options.
  Choose what is best on merit and build it properly. Only the user raises
  time.
- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push. Never commit a red state.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.

## Orchestration workflow

I act as orchestrator, not author. Every change to this repo --- content,
code, or configuration --- is drafted by a dispatched subagent, never written
by me directly and never accepted on its own report:

- A subagent reporting "pnpm check green" is necessary, not sufficient. A
  static spec suite can prove the hooks exist while real rendering/interaction
  is still broken --- independent re-verification (reading the actual diff,
  looking at real screenshots or driving the running app in a browser)
  happens before anything is committed.

## Spec: checkable vs judged

Split the published spec lines before writing tests. Mechanically checkable
ones get a test in `spec/`, asserting the contract (what the page must do),
not the markup or implementation. Ones only a person can judge don't get a
test --- name them here so nothing is silently assumed to be "handled."
