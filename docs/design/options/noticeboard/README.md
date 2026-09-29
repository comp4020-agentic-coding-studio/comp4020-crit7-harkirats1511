# Weekbook, "Noticeboard" direction

**Personality:** a well-kept university notice board: cream page, white paper card, ink text, hairline rules, one gold accent (nav underline, today marker, now line) and no shadows.

**Type:** headings and time labels in a serif (Source Serif 4, else Iowan/Palatino/Georgia); UI in Public Sans, else system-ui.

**Palette (contrast on paper #FFFDF9):** ink #221E19 16.3:1; muted ink #5A5045 7.7:1 (6.9:1 on cream #F5EFE2); clash clay #A23B28 6.5:1 (5.4:1 on its wash #F7E6DF); course inks blue #2C5876 7.5, moss #456B36 6.1, plum #6C4565 7.7, umber #7A5628 6.5. Gold #B4832A is decoration only (3.3:1, never text).

**Motion:** 200ms fade/settle (opacity + 4px translate), toast slide, hover lift 1px. All off under `prefers-reduced-motion`.

**Engineering needed:** real week/seat data, clash detection, move/undo persistence, room lookup on tap, recordings link, convenor email lookup.
