// The single writer for timetable state. FINAL signatures; workstream E owns this file and implements every stub.
// Rules for every mutation: one `BEGIN IMMEDIATE` transaction (use `client` from ../db), re-check capacity
// inside it (the student's own current option in the same group is not counted against the target),
// write `history` rows sharing one batchId, then call emitAllocChanged() AFTER commit.
// Services never throw for expected failures: they return { ok: false, code, message }.
import type {
  Allocation,
  AutofixResult,
  Catalog,
  ClashDetail,
  DraftOverlay,
  Move,
  Prefs,
  SeatsUsed,
} from "../engine/types";

/** The UI is single-user; the schema is multi-student. Seeded by workstream D. */
export const DEFAULT_STUDENT_ID = "me";

export type FailCode = "not_found" | "full" | "clash" | "invalid" | "stale" | "no_draft" | "nothing_to_undo";

export type MutationResult =
  | { ok: true; batchId: string | null; moves: Move[] }
  | { ok: false; code: FailCode; message: string; clashes?: ClashDetail[] };

/** Options for mutations that can target a draft instead of the real timetable. */
export interface DraftTarget {
  /** When set, write to that draft's overlay (no history, no seat check) instead of the real allocation. */
  draftId?: string | null;
}

export interface Draft {
  id: string;
  studentId: string;
  name: string;
  status: "open" | "applied" | "discarded";
  createdAt: string;
}

/** One history row (a change to one group). */
export interface HistoryEntry {
  id: number;
  groupId: string;
  fromOptionId: string | null;
  toOptionId: string | null;
}

/** One atomic user action: all rows sharing a batchId. Newest batch first. */
export interface HistoryBatch {
  batchId: string;
  source: "select" | "drop" | "move" | "swap" | "draft" | "autofix" | "undo" | "waitlist";
  createdAt: string;
  entries: HistoryEntry[];
  /** Batch this one reversed (source = "undo"). */
  undoesBatchId: string | null;
  /** Set once an undo reversed this batch. */
  undoneByBatchId: string | null;
  /** True for the newest not-yet-undone, non-undo batch (the one `undoLatest` would reverse). */
  undoable: boolean;
}

export interface WaitlistEntry {
  id: number;
  studentId: string;
  optionId: string;
  createdAt: string;
}

export interface SwapRequest {
  id: number;
  studentId: string;
  groupId: string;
  haveOptionId: string;
  wantOptionId: string;
  status: "open" | "matched" | "cancelled";
}

export interface AutofixPreview {
  result: AutofixResult;
  /** Fingerprint of the allocation the preview was computed from; confirm rejects with "stale" if it changed. */
  basis: string;
}

// ---------- reads ----------

/** Whole dataset for a term (default: the only/latest term) as an indexed Catalog. */
export function loadCatalog(termId?: string): Catalog {
  throw new Error("not implemented: loadCatalog");
}

/** The student's REAL allocation (groupId -> optionId). */
export function loadAllocation(studentId: string): Allocation {
  throw new Error("not implemented: loadAllocation");
}

/** Seats taken per option = COUNT(allocations) per option. Never a stored counter. */
export function seatsUsed(): SeatsUsed {
  throw new Error("not implemented: seatsUsed");
}

/** History grouped into batches, newest first. */
export function loadHistory(studentId: string, limit?: number): HistoryBatch[] {
  throw new Error("not implemented: loadHistory");
}

/** The student's open draft, or null. */
export function getOpenDraft(studentId: string): Draft | null {
  throw new Error("not implemented: getOpenDraft");
}

/** Overlay rows of a draft (groupId -> optionId | null). */
export function loadDraftOverlay(draftId: string): DraftOverlay {
  throw new Error("not implemented: loadDraftOverlay");
}

/** Stored preferences parsed via engine parsePrefs; defaultPrefs() when none saved. */
export function loadPrefs(studentId: string): Prefs {
  throw new Error("not implemented: loadPrefs");
}

export function loadWaitlist(studentId: string): WaitlistEntry[] {
  throw new Error("not implemented: loadWaitlist");
}

export function loadSwapRequests(studentId: string): SwapRequest[] {
  throw new Error("not implemented: loadSwapRequests");
}

// ---------- mutations ----------

/** Take `optionId` (replaces the student's option in that group). Fails "clash" if it clashes, "full" if no seat. Atomic across parts. */
export function selectOption(studentId: string, optionId: string, target?: DraftTarget): MutationResult {
  throw new Error("not implemented: selectOption");
}

/** Drop the student's option in `groupId`. */
export function dropGroup(studentId: string, groupId: string, target?: DraftTarget): MutationResult {
  throw new Error("not implemented: dropGroup");
}

/**
 * Apply several group changes as ONE batch, validated jointly (final allocation must be clash-free for the
 * moved groups and seats re-checked). All or nothing. `source` labels the history rows.
 */
export function moveBatch(
  studentId: string,
  moves: Move[],
  source?: "move" | "autofix",
  target?: DraftTarget,
): MutationResult {
  throw new Error("not implemented: moveBatch");
}

/** Join the waitlist for a full option (idempotent). Fails "invalid" if the option has a free seat or is already held. */
export function joinWaitlist(studentId: string, optionId: string): MutationResult {
  throw new Error("not implemented: joinWaitlist");
}

/** Record an open swap request: student holds `haveOptionId` in the group and wants `wantOptionId`. */
export function requestSwap(studentId: string, groupId: string, wantOptionId: string): MutationResult {
  throw new Error("not implemented: requestSwap");
}

/** Create an open draft (at most one open per student; returns the existing one's id semantics via `Draft`). */
export function newDraft(studentId: string, name?: string): Draft {
  throw new Error("not implemented: newDraft");
}

/** Revalidate seats, then replay the draft's diff against real as ONE batch (source "draft") and mark it applied. */
export function applyDraft(studentId: string, draftId: string): MutationResult {
  throw new Error("not implemented: applyDraft");
}

/** Mark the draft discarded and remove its overlay rows. */
export function discardDraft(studentId: string, draftId: string): MutationResult {
  throw new Error("not implemented: discardDraft");
}

/**
 * Undo the newest not-yet-undone batch (or `batchId`): replay the inverse as a new "undo" batch, mark the
 * original undoneByBatchId. Fails cleanly ("full"/"clash") if the target is now unavailable.
 */
export function undoLatest(studentId: string, batchId?: string): MutationResult {
  throw new Error("not implemented: undoLatest");
}

/** Compute (do not write) the minimal-move fix for the current real allocation using stored prefs. */
export function autofixPreview(studentId: string): AutofixPreview {
  throw new Error("not implemented: autofixPreview");
}

/** Recompute; if `basis` still matches apply the moves as one "autofix" batch, else fail "stale". */
export function autofixConfirm(studentId: string, basis: string): MutationResult {
  throw new Error("not implemented: autofixConfirm");
}

/** Validate untrusted input with engine parsePrefs and upsert. Fails "invalid" on bad shape. */
export function savePrefs(studentId: string, raw: unknown): { ok: true; prefs: Prefs } | { ok: false; code: "invalid"; message: string } {
  throw new Error("not implemented: savePrefs");
}
