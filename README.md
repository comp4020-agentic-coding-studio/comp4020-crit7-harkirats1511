# Daybook: MyTimetable clashes, fixed

Daybook is a student-built replacement for the clash handling in ANU MyTimetable, running on my real Semester 2 2026 courses (COMP3900, COMP4020, COMP4650 and FINM1001).

## The problem

In MyTimetable a clashing class cannot be chosen until you find the class it clashes with and move that one first, by reading times and trying options one by one. It also ignores which weeks classes run, so it cannot tell a real clash from two classes that never meet.

## How to use it

- **My week** shows one day at a time: what is on, what is next, and the one thing that clashes, with honest options when it cannot be fixed.
- **Change a class** draws every other time for a class on your day. Times that fit show the seats left; the rest say why not. Preview a time, then confirm the move.
- **Swap a time** ranks the times that fit (no overlaps first, then most seats to spare) and explains each one. Choose one, check the preview, then confirm.

Every change can be undone straight after, and History keeps the rest.

## What good means here

Clash detection is week-aware. Moves are checked as a whole, so moving one class never creates a new clash elsewhere. Optional drop-ins never clash. When nothing can fix a clash, the app says so instead of pretending. Everything works without JavaScript.

## Run and test

`pnpm dev` starts the app with a local database that seeds itself. `pnpm check` runs the typecheck, unit tests and the spec against the built server.

## Limits

The timetable data is transcribed from my own MyTimetable screenshots, not fetched from ANU. The app serves one student.
