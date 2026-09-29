// The single writer for timetable state. FINAL signatures; workstream E owns this file and implements every stub.
// Rules for every mutation: one `BEGIN IMMEDIATE` transaction (use `client` from ../db), re-check capacity
// inside it (the student's own current option in the same group is not counted against the target),
// write `history` rows sharing one batchId, then call emitAllocChanged() AFTER commit.
// Services never throw for expected failures: they return { ok: false, code, message }.
import { createHash, randomUUID } from "node:crypto";
import { client } from "../db";
import { emitAllocChanged } from "../events";
import { clashesFor } from "../engine/clash";
import { diffAlloc, effectiveAlloc } from "../engine/draft";
import { defaultPrefs, parsePrefs } from "../engine/prefs";
import { autofix } from "../engine/solve";
import type {
  Allocation,
  AutofixResult,
  Catalog,
  ClashDetail,
  Day,
  DraftOverlay,
  Group,
  Move,
  Option,
  Prefs,
  SeatsUsed,
  Term,
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
  /** selectOption/moveBatch only: skip the clash refusal (the student chose to accept a clash). Seats are still checked. */
  force?: boolean;
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

// ---------- internals ----------

type Row = Record<string, any>;
type Source = HistoryBatch["source"];

const fail = (code: FailCode, message: string, clashes?: ClashDetail[]): MutationResult =>
  clashes ? { ok: false, code, message, clashes } : { ok: false, code, message };

/**
 * Run `fn` inside BEGIN IMMEDIATE (write lock taken up front, so the seat re-check inside is race-free even
 * across processes). Commits only when `fn` returns ok (or a non-result value); rolls back on failure/throw.
 * The event is emitted by the caller AFTER this returns, i.e. after commit.
 */
function inTx<T>(fn: () => T): T {
  client.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    if (r && typeof r === "object" && "ok" in r && (r as { ok: boolean }).ok === false) client.exec("ROLLBACK");
    else client.exec("COMMIT");
    return r;
  } catch (e) {
    if (client.inTransaction) client.exec("ROLLBACK");
    throw e;
  }
}

function finish(studentId: string, r: MutationResult, source: string): MutationResult {
  if (r.ok) emitAllocChanged({ studentId, batchId: r.batchId, source });
  return r;
}

function readAlloc(studentId: string): Allocation {
  const rows = client.prepare("SELECT group_id, option_id FROM allocations WHERE student_id = ?").all(studentId) as Row[];
  return new Map(rows.map((r) => [r.group_id as string, r.option_id as string]));
}

function seatCount(optionId: string): number {
  return (client.prepare("SELECT COUNT(*) AS n FROM allocations WHERE option_id = ?").get(optionId) as Row).n as number;
}

interface PlanOpts {
  force?: boolean;
  checkClash: boolean;
  checkSeats: boolean;
  /** A null fromOptionId must also match (undo). Otherwise null means "don't care". */
  strictFrom?: boolean;
}

type Plan = { ok: true; moves: Move[]; final: Allocation } | { ok: false; result: MutationResult };

/** Validate `moves` jointly against `base`. Pure apart from seat reads. Returns the effective (non-no-op) moves with real `from`s. */
function plan(catalog: Catalog, base: Allocation, moves: Move[], o: PlanOpts): Plan {
  const seen = new Set<string>();
  const eff: Move[] = [];
  const final: Allocation = new Map(base);
  for (const m of moves) {
    if (!m || typeof m.groupId !== "string" || !catalog.groups.has(m.groupId))
      return { ok: false, result: fail("not_found", `Unknown group ${String(m?.groupId)}.`) };
    if (seen.has(m.groupId)) return { ok: false, result: fail("invalid", "A group appears twice in one batch.") };
    seen.add(m.groupId);
    const actual = base.get(m.groupId) ?? null;
    const claimed = m.fromOptionId ?? null;
    if ((claimed !== null || o.strictFrom) && claimed !== actual)
      return { ok: false, result: fail("stale", "The timetable changed since this was prepared. Reload and try again.") };
    const to = m.toOptionId ?? null;
    if (to !== null) {
      const opt = catalog.options.get(to);
      if (!opt) return { ok: false, result: fail("not_found", `Unknown option ${to}.`) };
      if (opt.groupId !== m.groupId) return { ok: false, result: fail("invalid", "Option does not belong to that group.") };
    }
    if (actual === to) continue;
    eff.push({ groupId: m.groupId, fromOptionId: actual, toOptionId: to });
    if (to === null) final.delete(m.groupId);
    else final.set(m.groupId, to);
  }
  // Seats first: a full option is refused as "full" even when it also clashes (a resolve panel cannot free a seat).
  if (o.checkSeats) {
    for (const m of eff) {
      if (!m.toOptionId) continue;
      const cap = catalog.options.get(m.toOptionId)?.capacity ?? null;
      if (cap === null) continue;
      // The student's own row in this group is a different option (no-ops were filtered), so it is not counted here.
      if (seatCount(m.toOptionId) >= cap)
        return { ok: false, result: fail("full", "That option is full.") };
    }
  }
  if (o.checkClash && !o.force) {
    const found: ClashDetail[] = [];
    for (const m of eff) if (m.toOptionId) found.push(...clashesFor(m.toOptionId, final, catalog));
    if (found.length) return { ok: false, result: fail("clash", "That choice clashes with another class in your timetable.", found) };
  }
  return { ok: true, moves: eff, final };
}

/** Write real allocation changes + history for already-validated moves. */
function writeReal(studentId: string, moves: Move[], source: Source, extra?: { undoesBatchId?: string }): string | null {
  if (moves.length === 0) return null;
  const batchId = randomUUID();
  const del = client.prepare("DELETE FROM allocations WHERE student_id = ? AND group_id = ?");
  const up = client.prepare(
    `INSERT INTO allocations (student_id, group_id, option_id) VALUES (?, ?, ?)
     ON CONFLICT(student_id, group_id) DO UPDATE SET option_id = excluded.option_id`,
  );
  const hist = client.prepare(
    `INSERT INTO history (student_id, batch_id, group_id, from_option_id, to_option_id, source, undoes_batch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const m of moves) {
    if (m.toOptionId === null) del.run(studentId, m.groupId);
    else up.run(studentId, m.groupId, m.toOptionId);
    hist.run(studentId, batchId, m.groupId, m.fromOptionId, m.toOptionId, source, extra?.undoesBatchId ?? null);
  }
  return batchId;
}

function draftRow(studentId: string, draftId: string): Row | undefined {
  return client
    .prepare("SELECT * FROM drafts WHERE id = ? AND student_id = ? AND status = 'open'")
    .get(draftId, studentId) as Row | undefined;
}

function readOverlay(draftId: string): DraftOverlay {
  const rows = client.prepare("SELECT group_id, option_id FROM draft_allocations WHERE draft_id = ?").all(draftId) as Row[];
  return new Map(rows.map((r) => [r.group_id as string, (r.option_id as string | null) ?? null]));
}

/** Shared mutation path: real (history + seats) or draft overlay (neither). */
function mutate(
  studentId: string,
  moves: Move[],
  source: Source,
  target: DraftTarget | undefined,
): MutationResult {
  const draftId = target?.draftId ?? null;
  const catalog = loadCatalog();
  const res = inTx((): MutationResult => {
    if (draftId) {
      if (!draftRow(studentId, draftId)) return fail("no_draft", "That draft is not open.");
      const real = readAlloc(studentId);
      const base = effectiveAlloc(real, readOverlay(draftId));
      const p = plan(catalog, base, moves, { force: target?.force, checkClash: true, checkSeats: false });
      if (!p.ok) return p.result;
      const del = client.prepare("DELETE FROM draft_allocations WHERE draft_id = ? AND group_id = ?");
      const up = client.prepare(
        `INSERT INTO draft_allocations (draft_id, group_id, option_id) VALUES (?, ?, ?)
         ON CONFLICT(draft_id, group_id) DO UPDATE SET option_id = excluded.option_id`,
      );
      for (const m of p.moves) {
        const r = real.get(m.groupId) ?? null;
        if (r === m.toOptionId) del.run(draftId, m.groupId);
        else up.run(draftId, m.groupId, m.toOptionId);
      }
      return { ok: true, batchId: null, moves: p.moves };
    }
    const base = readAlloc(studentId);
    const p = plan(catalog, base, moves, { force: target?.force, checkClash: true, checkSeats: true });
    if (!p.ok) return p.result;
    if (p.moves.length === 0) return { ok: true, batchId: null, moves: [] };
    return { ok: true, batchId: writeReal(studentId, p.moves, source), moves: p.moves };
  });
  return finish(studentId, res, draftId ? "draft" : source);
}

// ---------- reads ----------

/** Whole dataset for a term (default: the only/latest term) as an indexed Catalog. */
export function loadCatalog(termId?: string): Catalog {
  const catalog: Catalog = {
    terms: new Map(),
    courses: new Map(),
    groups: new Map(),
    options: new Map(),
    groupsByCourse: new Map(),
  };
  const t = (termId
    ? client.prepare("SELECT * FROM terms WHERE id = ?").get(termId)
    : client.prepare("SELECT * FROM terms ORDER BY start_date DESC, id LIMIT 1").get()) as Row | undefined;
  if (!t) return catalog;
  const term: Term = {
    id: t.id,
    name: t.name,
    startDate: t.start_date,
    teachingWeeks: t.teaching_weeks,
    breakAfterWeek: t.break_after_week ?? null,
  };
  catalog.terms.set(term.id, term);

  const courseRows = client.prepare("SELECT * FROM courses WHERE term_id = ? ORDER BY code, id").all(term.id) as Row[];
  const aliasRows = client.prepare("SELECT course_id, code FROM course_aliases ORDER BY id").all() as Row[];
  const groupRows = client.prepare("SELECT * FROM activity_groups ORDER BY sort_order, id").all() as Row[];
  const optionRows = client.prepare("SELECT * FROM options ORDER BY sort_order, code, id").all() as Row[];
  const sessionRows = client.prepare("SELECT * FROM sessions ORDER BY part, day, start_min, id").all() as Row[];

  for (const c of courseRows) {
    catalog.courses.set(c.id, {
      id: c.id,
      termId: c.term_id,
      code: c.code,
      title: c.title,
      aliases: aliasRows.filter((a) => a.course_id === c.id).map((a) => a.code as string),
      groups: [],
    });
    catalog.groupsByCourse.set(c.id, []);
  }
  for (const g of groupRows) {
    const course = catalog.courses.get(g.course_id);
    if (!course) continue;
    const group: Group = {
      id: g.id,
      courseId: g.course_id,
      kind: g.kind,
      name: g.name,
      exemptFromClash: !!g.exempt_from_clash,
      options: [],
    };
    course.groups.push(group);
    catalog.groups.set(group.id, group);
    catalog.groupsByCourse.get(course.id)!.push(group.id);
  }
  for (const o of optionRows) {
    const group = catalog.groups.get(o.group_id);
    if (!group) continue;
    const option: Option = {
      id: o.id,
      groupId: o.group_id,
      code: o.code,
      capacity: o.capacity ?? null,
      campus: o.campus ?? null,
      staff: o.staff ?? null,
      overflow: !!o.overflow,
      sessions: [],
    };
    group.options.push(option);
    catalog.options.set(option.id, option);
  }
  for (const s of sessionRows) {
    const option = catalog.options.get(s.option_id);
    if (!option) continue;
    option.sessions.push({
      id: s.id,
      optionId: s.option_id,
      part: s.part,
      day: s.day as Day,
      startMin: s.start_min,
      endMin: s.end_min,
      weeks: s.weeks,
      location: s.location ?? null,
      exempt: !!s.exempt,
    });
  }
  return catalog;
}

/** The student's REAL allocation (groupId -> optionId). */
export function loadAllocation(studentId: string): Allocation {
  return readAlloc(studentId);
}

/** Seats taken per option = COUNT(allocations) per option. Never a stored counter. */
export function seatsUsed(): SeatsUsed {
  const rows = client.prepare("SELECT option_id, COUNT(*) AS n FROM allocations GROUP BY option_id").all() as Row[];
  return new Map(rows.map((r) => [r.option_id as string, r.n as number]));
}

/** History grouped into batches, newest first. `limit` = max batches (default 100). */
export function loadHistory(studentId: string, limit = 100): HistoryBatch[] {
  const rows = client.prepare("SELECT * FROM history WHERE student_id = ? ORDER BY id DESC").all(studentId) as Row[];
  const byBatch = new Map<string, HistoryBatch>();
  for (const r of rows) {
    let b = byBatch.get(r.batch_id);
    if (!b) {
      b = {
        batchId: r.batch_id,
        source: r.source,
        createdAt: r.created_at,
        entries: [],
        undoesBatchId: r.undoes_batch_id ?? null,
        undoneByBatchId: r.undone_by_batch_id ?? null,
        undoable: false,
      };
      byBatch.set(r.batch_id, b);
    }
    b.entries.unshift({ id: r.id, groupId: r.group_id, fromOptionId: r.from_option_id, toOptionId: r.to_option_id });
    if (r.undone_by_batch_id) b.undoneByBatchId = r.undone_by_batch_id;
  }
  const all = [...byBatch.values()];
  const newest = all.find((b) => b.source !== "undo" && b.undoneByBatchId === null);
  if (newest) newest.undoable = true;
  return all.slice(0, Math.max(0, limit));
}

function toDraft(r: Row): Draft {
  return { id: r.id, studentId: r.student_id, name: r.name, status: r.status, createdAt: r.created_at };
}

/** The student's open draft, or null. */
export function getOpenDraft(studentId: string): Draft | null {
  const r = client
    .prepare("SELECT * FROM drafts WHERE student_id = ? AND status = 'open' ORDER BY created_at DESC, rowid DESC LIMIT 1")
    .get(studentId) as Row | undefined;
  return r ? toDraft(r) : null;
}

/** Overlay rows of a draft (groupId -> optionId | null). */
export function loadDraftOverlay(draftId: string): DraftOverlay {
  return readOverlay(draftId);
}

/** Stored preferences parsed via engine parsePrefs; defaultPrefs() when none saved (or unreadable). */
export function loadPrefs(studentId: string): Prefs {
  const r = client.prepare("SELECT data FROM preferences WHERE student_id = ?").get(studentId) as Row | undefined;
  if (!r) return defaultPrefs();
  try {
    return parsePrefs(JSON.parse(r.data));
  } catch {
    return defaultPrefs();
  }
}

export function loadWaitlist(studentId: string): WaitlistEntry[] {
  const rows = client.prepare("SELECT * FROM waitlist WHERE student_id = ? ORDER BY id").all(studentId) as Row[];
  return rows.map((r) => ({ id: r.id, studentId: r.student_id, optionId: r.option_id, createdAt: r.created_at }));
}

export function loadSwapRequests(studentId: string): SwapRequest[] {
  const rows = client.prepare("SELECT * FROM swap_requests WHERE student_id = ? ORDER BY id").all(studentId) as Row[];
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    groupId: r.group_id,
    haveOptionId: r.have_option_id,
    wantOptionId: r.want_option_id,
    status: r.status,
  }));
}

// ---------- mutations ----------

/** Take `optionId` (replaces the student's option in that group). Fails "clash" if it clashes, "full" if no seat. Atomic across parts. */
export function selectOption(studentId: string, optionId: string, target?: DraftTarget): MutationResult {
  const opt = loadCatalog().options.get(optionId);
  if (!opt) return fail("not_found", "No such option.");
  // fromOptionId null = "whatever is held now" (plan fills in the real value).
  return mutate(studentId, [{ groupId: opt.groupId, fromOptionId: null, toOptionId: optionId }], "select", target);
}

/** Drop the student's option in `groupId`. */
export function dropGroup(studentId: string, groupId: string, target?: DraftTarget): MutationResult {
  if (!loadCatalog().groups.has(groupId)) return fail("not_found", "No such group.");
  return mutate(studentId, [{ groupId, fromOptionId: null, toOptionId: null }], "drop", target);
}

/**
 * Apply several group changes as ONE batch, validated jointly (final allocation must be clash-free for the
 * moved groups and seats re-checked). All or nothing. `source` labels the history rows.
 * A non-null `fromOptionId` that no longer matches the timetable fails "stale"; null means "whatever is held".
 * `target.force` skips the clash refusal.
 */
export function moveBatch(
  studentId: string,
  moves: Move[],
  source: "move" | "autofix" = "move",
  target?: DraftTarget,
): MutationResult {
  if (!Array.isArray(moves) || moves.length === 0) return fail("invalid", "No moves given.");
  return mutate(studentId, moves, source, target);
}

/** Join the waitlist for a full option (idempotent). Fails "invalid" if the option has a free seat or is already held. */
export function joinWaitlist(studentId: string, optionId: string): MutationResult {
  const opt = loadCatalog().options.get(optionId);
  if (!opt) return fail("not_found", "No such option.");
  const res = inTx((): MutationResult => {
    if (readAlloc(studentId).get(opt.groupId) === optionId) return fail("invalid", "You already hold that option.");
    if (opt.capacity === null || seatCount(optionId) < opt.capacity)
      return fail("invalid", "That option is not full, so you can select it directly.");
    client.prepare("INSERT OR IGNORE INTO waitlist (student_id, option_id) VALUES (?, ?)").run(studentId, optionId);
    return { ok: true, batchId: null, moves: [] };
  });
  return finish(studentId, res, "waitlist");
}

/** Record an open swap request: student holds `haveOptionId` in the group and wants `wantOptionId`. */
export function requestSwap(studentId: string, groupId: string, wantOptionId: string): MutationResult {
  const catalog = loadCatalog();
  const want = catalog.options.get(wantOptionId);
  if (!catalog.groups.has(groupId)) return fail("not_found", "No such group.");
  if (!want) return fail("not_found", "No such option.");
  if (want.groupId !== groupId) return fail("invalid", "Option does not belong to that group.");
  const res = inTx((): MutationResult => {
    const have = readAlloc(studentId).get(groupId);
    if (!have) return fail("invalid", "You hold no option in that group to swap from.");
    if (have === wantOptionId) return fail("invalid", "You already hold that option.");
    const dup = client
      .prepare(
        "SELECT id FROM swap_requests WHERE student_id = ? AND group_id = ? AND have_option_id = ? AND want_option_id = ? AND status = 'open'",
      )
      .get(studentId, groupId, have, wantOptionId);
    if (!dup)
      client
        .prepare("INSERT INTO swap_requests (student_id, group_id, have_option_id, want_option_id) VALUES (?, ?, ?, ?)")
        .run(studentId, groupId, have, wantOptionId);
    return { ok: true, batchId: null, moves: [] };
  });
  return finish(studentId, res, "swap");
}

/** Create an open draft (at most one open per student; returns the existing one if there is one). */
export function newDraft(studentId: string, name?: string): Draft {
  let created = false;
  const d = inTx(() => {
    const existing = client
      .prepare("SELECT * FROM drafts WHERE student_id = ? AND status = 'open' ORDER BY created_at DESC, rowid DESC LIMIT 1")
      .get(studentId) as Row | undefined;
    if (existing) return toDraft(existing);
    const id = randomUUID();
    const label = (name ?? "").trim().slice(0, 80) || "Draft";
    client.prepare("INSERT INTO drafts (id, student_id, name) VALUES (?, ?, ?)").run(id, studentId, label);
    created = true;
    return toDraft(client.prepare("SELECT * FROM drafts WHERE id = ?").get(id) as Row);
  });
  if (created) emitAllocChanged({ studentId, batchId: null, source: "draft" });
  return d;
}

/** Revalidate seats + clashes, then replay the draft's diff against real as ONE batch (source "draft") and mark it applied. */
export function applyDraft(studentId: string, draftId: string): MutationResult {
  const catalog = loadCatalog();
  const res = inTx((): MutationResult => {
    if (!draftRow(studentId, draftId)) return fail("no_draft", "That draft is not open.");
    const real = readAlloc(studentId);
    const moves = diffAlloc(real, effectiveAlloc(real, readOverlay(draftId)));
    const p = plan(catalog, real, moves, { checkClash: true, checkSeats: true, strictFrom: true });
    if (!p.ok) return p.result;
    const batchId = writeReal(studentId, p.moves, "draft");
    client.prepare("UPDATE drafts SET status = 'applied' WHERE id = ?").run(draftId);
    return { ok: true, batchId, moves: p.moves };
  });
  return finish(studentId, res, "draft");
}

/** Mark the draft discarded and remove its overlay rows. */
export function discardDraft(studentId: string, draftId: string): MutationResult {
  const res = inTx((): MutationResult => {
    if (!draftRow(studentId, draftId)) return fail("no_draft", "That draft is not open.");
    client.prepare("UPDATE drafts SET status = 'discarded' WHERE id = ?").run(draftId);
    client.prepare("DELETE FROM draft_allocations WHERE draft_id = ?").run(draftId);
    return { ok: true, batchId: null, moves: [] };
  });
  return finish(studentId, res, "draft");
}

/**
 * Undo the newest not-yet-undone batch (or `batchId`): replay the inverse as a new "undo" batch, mark the
 * original undoneByBatchId. Fails "full" if a target option has no seat, "stale" if the timetable no longer
 * matches what the batch produced. Clashes are not re-checked: undo restores a state the student already had.
 */
export function undoLatest(studentId: string, batchId?: string): MutationResult {
  const catalog = loadCatalog();
  const res = inTx((): MutationResult => {
    let target: string | undefined = batchId;
    if (target) {
      const row = client
        .prepare("SELECT source, undone_by_batch_id FROM history WHERE student_id = ? AND batch_id = ? LIMIT 1")
        .get(studentId, target) as Row | undefined;
      if (!row) return fail("not_found", "No such history batch.");
      if (row.source === "undo") return fail("invalid", "An undo cannot be undone.");
      if (row.undone_by_batch_id) return fail("invalid", "That batch was already undone.");
    } else {
      const row = client
        .prepare(
          `SELECT batch_id FROM history WHERE student_id = ? AND source != 'undo' AND undone_by_batch_id IS NULL
           ORDER BY id DESC LIMIT 1`,
        )
        .get(studentId) as Row | undefined;
      if (!row) return fail("nothing_to_undo", "There is nothing to undo.");
      target = row.batch_id as string;
    }
    const entries = client
      .prepare("SELECT * FROM history WHERE student_id = ? AND batch_id = ? ORDER BY id")
      .all(studentId, target) as Row[];
    const inverse: Move[] = entries.map((e) => ({
      groupId: e.group_id,
      fromOptionId: e.to_option_id ?? null,
      toOptionId: e.from_option_id ?? null,
    }));
    const p = plan(catalog, readAlloc(studentId), inverse, { checkClash: false, checkSeats: true, strictFrom: true });
    if (!p.ok) return p.result;
    const undoId = writeReal(studentId, p.moves, "undo", { undoesBatchId: target });
    client.prepare("UPDATE history SET undone_by_batch_id = ? WHERE student_id = ? AND batch_id = ?").run(undoId, studentId, target);
    return { ok: true, batchId: undoId, moves: p.moves };
  });
  return finish(studentId, res, "undo");
}

function fingerprint(alloc: Allocation): string {
  const s = [...alloc.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([g, o]) => `${g}=${o}`).join("|");
  return createHash("sha1").update(s).digest("hex");
}

/** Compute (do not write) the minimal-move fix for the current real allocation using stored prefs. */
export function autofixPreview(studentId: string): AutofixPreview {
  const catalog = loadCatalog();
  const alloc = readAlloc(studentId);
  const result = autofix(alloc, catalog, seatsUsed(), loadPrefs(studentId));
  return { result, basis: fingerprint(alloc) };
}

/** Recompute; if `basis` still matches apply the moves as one "autofix" batch, else fail "stale". */
export function autofixConfirm(studentId: string, basis: string): MutationResult {
  const catalog = loadCatalog();
  const prefs = loadPrefs(studentId);
  const res = inTx((): MutationResult => {
    const alloc = readAlloc(studentId);
    if (fingerprint(alloc) !== basis) return fail("stale", "Your timetable changed since the preview. Review the fix again.");
    const result = autofix(alloc, catalog, seatsUsed(), prefs);
    if (result.alreadyClean) return fail("invalid", "Your timetable has no clashes to fix.");
    if (!result.solved || result.moves.length === 0) return fail("invalid", "No clash-free fix was found.");
    // Joint validation of the whole batch (clashes among moved groups + seats), all or nothing.
    const p = plan(catalog, alloc, result.moves, { checkClash: true, checkSeats: true, strictFrom: true });
    if (!p.ok) return p.result;
    return { ok: true, batchId: writeReal(studentId, p.moves, "autofix"), moves: p.moves };
  });
  return finish(studentId, res, "autofix");
}

/** Validate untrusted input with engine parsePrefs and upsert. Fails "invalid" on bad shape. */
export function savePrefs(studentId: string, raw: unknown): { ok: true; prefs: Prefs } | { ok: false; code: "invalid"; message: string } {
  let prefs: Prefs;
  try {
    // parsePrefs is lenient (bad fields fall back to defaults), so reject a wrong overall shape here.
    const shape = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (shape === null || typeof shape !== "object" || Array.isArray(shape)) throw new Error("Preferences must be an object.");
    prefs = parsePrefs(raw);
  } catch (e) {
    return { ok: false, code: "invalid", message: e instanceof Error ? e.message : "Invalid preferences." };
  }
  inTx(() => {
    client
      .prepare(
        `INSERT INTO preferences (student_id, data, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(student_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(studentId, JSON.stringify(prefs));
    return true;
  });
  return { ok: true, prefs };
}
