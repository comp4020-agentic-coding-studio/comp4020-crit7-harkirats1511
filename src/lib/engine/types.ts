// Shared, FINAL engine contracts. Pure types: no DB or Astro imports anywhere in src/lib/engine.
// Only the foundation workstream edits this file; everyone else imports from it.

/** Bitmask over teaching weeks 1..13: bit (i-1) set means week i. Break weeks never appear. */
export type WeekMask = number;

/** Day of week, 0 = Monday ... 6 = Sunday. */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type GroupKind = "lecture" | "tutorial" | "workshop" | "lab" | "dropin" | "other";

/** One meeting pattern of an option. A multi-part option has several (P1, P2). */
export interface Session {
  id: string;
  optionId: string;
  /** "P1", "P2", ... A single-part option has one session with part "P1". */
  part: string;
  day: Day;
  /** Minutes since midnight, e.g. 14:00 = 840. */
  startMin: number;
  endMin: number;
  weeks: WeekMask;
  /** Building/room text, null when not published. */
  location: string | null;
  /** Clash-exempt (e.g. a drop-in bundled inside an option). A session is exempt when session.exempt OR its group.exemptFromClash. */
  exempt: boolean;
}

/** The unit a student selects (e.g. "TutA 01"). Seats are per option, never per part. */
export interface Option {
  id: string;
  groupId: string;
  /** Display code within the group, e.g. "01". */
  code: string;
  /** null = not published (render "Not published", never zero or full). */
  capacity: number | null;
  campus: string | null;
  staff: string | null;
  /** Overflow/virtual clone (e.g. "01_Clone": same slot, huge capacity, location NA). UI shows "overflow / virtual". */
  overflow: boolean;
  /** Ordered by part. Always at least one. */
  sessions: Session[];
}

/** An activity group (e.g. "Tut A"): a student holds at most one option per group. */
export interface Group {
  id: string;
  courseId: string;
  kind: GroupKind;
  /** e.g. "Tut A". */
  name: string;
  /** Every session in this group is exempt from clashes, in either direction. A session is exempt when session.exempt OR its group.exemptFromClash. */
  exemptFromClash: boolean;
  /** Ordered by option code. */
  options: Option[];
}

export interface Course {
  id: string;
  termId: string;
  /** e.g. "COMP4020". */
  code: string;
  title: string;
  /** Cross-listed codes, display only (e.g. "COMP6020"). */
  aliases: string[];
  groups: Group[];
}

export interface Term {
  id: string;
  name: string;
  /** ISO date (YYYY-MM-DD) of the Monday of teaching week 1. */
  startDate: string;
  /** Number of teaching weeks (real term: 12, mid-sem break after week 6; WeekMask stays a 1..13 bitmask). */
  teachingWeeks: number;
  /** The break sits after this teaching week (null = no break). After the break the calendar advances by TWO weeks (week 6 = Mon 2026-08-31, week 7 = Mon 2026-09-21). */
  breakAfterWeek: number | null;
}

/** Whole loaded dataset with indexed lookups. Built by services.loadCatalog(). */
export interface Catalog {
  terms: Map<string, Term>;
  courses: Map<string, Course>;
  groups: Map<string, Group>;
  options: Map<string, Option>;
  /** courseId -> group ids in order. */
  groupsByCourse: Map<string, string[]>;
}

/** A student's timetable: groupId -> optionId. */
export type Allocation = Map<string, string>;

/** Seats taken per option id (COUNT of allocations). Missing key = 0. */
export type SeatsUsed = Map<string, number>;

/** Why two options clash: every overlapping session pair. */
export interface SessionClash {
  a: Session;
  b: Session;
  day: Day;
  /** Overlapping minutes (> 0). */
  minutes: number;
  /** Weeks in which both run. Non-zero. */
  weeks: WeekMask;
  /** Overlapping window, minutes since midnight. */
  fromMin: number;
  toMin: number;
}

/** Two options that clash. `a` is the subject option, `b` the one it collides with. */
export interface ClashDetail {
  optionA: string;
  optionB: string;
  groupA: string;
  groupB: string;
  /** Non-empty, ordered by day then start. */
  overlaps: SessionClash[];
  /** Union of overlap weeks. */
  weeks: WeekMask;
  /** Sum of overlap minutes over all pairs (informational). */
  totalMinutes: number;
}

export type OptionStateKind = "yours" | "clash" | "full" | "select";

/**
 * State of an option for a student. Precedence for `kind`: yours > clash > full > select.
 * `full` and `clashes` are also reported independently so the UI can show both.
 */
export interface OptionState {
  optionId: string;
  kind: OptionStateKind;
  /** null when capacity is not published. */
  seatsLeft: number | null;
  full: boolean;
  /** Clashes with the student's OTHER groups' options (empty when kind = yours or exempt). */
  clashes: ClashDetail[];
}

/** A single change to one group of the timetable. null = none (drop / was empty). */
export interface Move {
  groupId: string;
  fromOptionId: string | null;
  toOptionId: string | null;
}

/** A candidate destination for a group (either A's own group or a blocker's). */
export interface Candidate {
  optionId: string;
  /** Clash-free against the plan-in-progress (A chosen, blocker's old slot removed). */
  safe: boolean;
  /** Clashes that make it unsafe (empty when safe). */
  newClashes: ClashDetail[];
  full: boolean;
  seatsLeft: number | null;
}

/** For one blocker B (an allocated option that clashes with A): where B could move. */
export interface BlockerPlan {
  groupId: string;
  currentOptionId: string;
  /** The clash between A and this blocker. */
  clash: ClashDetail;
  /** Every other option of the blocker's group, safe ones first. */
  candidates: Candidate[];
}

/** Result of resolveClash(A): what the student can do to take option A. */
export interface ResolvePlan {
  /** The option the student wants (A). */
  optionId: string;
  groupId: string;
  /** Clashes of A with the current allocation (empty = A is directly selectable). */
  clashes: ClashDetail[];
  /** Other options in A's group (clash-free first) the student could take instead. */
  alternatives: Candidate[];
  /** One entry per blocker group: move the blocker away, then take A. */
  blockerMoves: BlockerPlan[];
}

/** Student preferences. Times in minutes since midnight. */
export interface Prefs {
  /** Days the student wants free of classes. */
  daysOff: Day[];
  /** Penalise sessions starting before this. null = no preference. */
  earliestStartMin: number | null;
  /** Penalise sessions ending after this. null = no preference. */
  latestEndMin: number | null;
  /** Penalise gaps between same-day sessions longer than this (minutes). null = no preference. */
  maxGapMin: number | null;
  /** Penalise consecutive sessions on different campuses/buildings closer than this (minutes). null = off. */
  minWalkGapMin: number | null;
  /** Weight per unit; 0 disables that term. */
  weights: {
    dayOff: number;
    early: number;
    late: number;
    gap: number;
    walk: number;
  };
}

export interface PrefPenalty {
  kind: "dayOff" | "early" | "late" | "gap" | "walk";
  points: number;
  /** Human-readable reason, e.g. "Mon has 2 sessions but is a preferred day off". */
  detail: string;
}

/** Lower total = better. 0 = perfect. */
export interface PrefScore {
  total: number;
  penalties: PrefPenalty[];
}

/** Draft overlay: groupId -> optionId (change) or null (drop). Groups absent = unchanged. */
export type DraftOverlay = Map<string, string | null>;

export interface AutofixOptions {
  /** Node cap for the branch-and-bound. Default 200_000. */
  nodeCap?: number;
}

export interface AutofixResult {
  /** Fewest-move plan (ties broken by best pref score). Empty if nothing to fix or no fix found. */
  moves: Move[];
  /** Clash-free result exists. */
  solved: boolean;
  /** Nothing to fix. */
  alreadyClean: boolean;
  /** Search hit the node cap before proving minimality. */
  capped: boolean;
  nodes: number;
  /** Score of the resulting allocation (null when prefs not supplied). */
  score: PrefScore | null;
  /** Allocation after applying `moves`. */
  resulting: Allocation;
}
