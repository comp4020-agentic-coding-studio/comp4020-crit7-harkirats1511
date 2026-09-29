# Seed hand-fill guide

Data lives in `seed/sem2-2026.json` (course > group > option > sessions). `pnpm db:seed` validates it and upserts it into the database.

## Commands

- `pnpm db:seed` loads the file. It upserts by id and keeps your current allocations.
- `pnpm db:seed --strict` also rejects any `"TODO"` marker. It fails while a group or weeks value is still TODO.
- `pnpm db:seed --reset` wipes every app table first, so the starting allocations from the file come back.
- The app calls `seedIfEmpty()` on boot. It does nothing once the `terms` table has a row.

## Ids

Course id is the lowercase code (`comp4020`). Group id is `<course>-<group>` (`comp4020-tuta`). Option id is `<group>-<option code lowercase>` (`comp4020-tuta-04`, `comp3900-leca-01_clone`). Session id is `<option id>-p1`. Give `id` explicitly on courses and groups. Option `code` is the MyTT text (`"04"`, `"01_Clone"`).

## Filling in one option

```json
{ "code": "04", "capacity": 2, "campus": "ACTON", "staff": null, "sessions": [
  { "part": "P1", "day": "Wed", "start": "10:30", "end": "12:00",
    "weeks": "5/8-2/9, 23/9-28/10", "location": "Rm 4.03_Marie Reay Bldg 155" } ] }
```

- **capacity**: MyTT "Free", plus 1 for the option you hold (Free excludes your own seat). Unknown: `null` (shown as "Not published").
- **staff**: a name, or `null` for "-" and for raw u-numbers. Never put a u-number or email in this repo.
- **weeks**: paste MyTT's date string as shown (`"27/7-31/8, 21/9-28/9, 12/10-26/10"`, `"6/10"`, `"4/8, 18/8, 22/9-29/9"`), or teaching weeks (`"1-8,10-12"`). Every date must fall on the session's weekday and inside the term, not in the break. The validator says which one is wrong.
- **dropIn**: `true` on the 0.5 hr DroA part bundled in an option. Drop-ins never clash. A whole drop-in group sets `"exemptFromClash": true` on the group.
- **overflow**: `true` on `01_Clone` options; use `"location": null`.
- Multi-part options list every part (`P1`, `P2`) in the order MyTT shows them.
- **enrolled**: leave 0. A number inserts that many placeholder students so seats used match.

## Missing data

Set a group's `"options": "TODO"` (or a session's `"weeks": "TODO"`). Draft mode warns and the loader skips it. Fill it in, then run `pnpm db:seed --strict`.

## Allocations

`"allocations": [{ "group": "comp4020-tuta", "option": "04" }]` are the options you hold at first boot, one per group.
