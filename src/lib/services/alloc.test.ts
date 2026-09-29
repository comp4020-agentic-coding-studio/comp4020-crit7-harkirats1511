import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bus, ALLOC_CHANGED } from "../events";

// Own temp database: db.ts reads DATABASE_PATH at import time, so import lazily after setting it.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "svc-db-")), "test.db");
const { client } = await import("../db");
const svc = await import("./alloc");
const ME = svc.DEFAULT_STUDENT_ID;

const W = 0b111111; // weeks 1-6

function insertCatalog() {
  client.exec(`
    DELETE FROM sessions; DELETE FROM options; DELETE FROM activity_groups; DELETE FROM courses; DELETE FROM terms;
    INSERT INTO terms (id, name, start_date, teaching_weeks, break_after_week) VALUES ('t', 'Test', '2026-07-27', 12, 6);
    INSERT INTO courses (id, term_id, code, title) VALUES ('c1', 't', 'C1', 'Course 1'), ('c2', 't', 'C2', 'Course 2');
    INSERT INTO activity_groups (id, course_id, kind, name) VALUES
      ('g1','c1','tutorial','G1'), ('g2','c2','tutorial','G2'), ('g3','c2','lab','G3'), ('g4','c1','workshop','G4');
    INSERT INTO options (id, group_id, code, capacity) VALUES
      ('g1-a','g1','a',2), ('g1-b','g1','b',1), ('g1-c','g1','c',NULL), ('g1-d','g1','d',5),
      ('g2-a','g2','a',5), ('g2-b','g2','b',5),
      ('g3-a','g3','a',5),
      ('g4-a','g4','a',5);
    -- day: 0 Mon.. ; minutes: 540 = 09:00
    INSERT INTO sessions (id, option_id, part, day, start_min, end_min, weeks) VALUES
      ('s1','g1-a','P1',0,540,600,${W}),
      ('s2','g1-b','P1',1,540,600,${W}),
      ('s3','g1-c','P1',1,720,780,${W}),
      ('s3b','g1-d','P1',4,780,840,${W}),
      ('s4','g2-a','P1',0,570,630,${W}),   -- Mon 09:30 clashes with g1-a
      ('s5','g2-b','P1',2,540,600,${W}),
      ('s6','g3-a','P1',3,540,600,${W}),
      ('s7','g3-a','P2',4,540,600,${W}),   -- multi-part: Fri 09:00
      ('s8','g4-a','P1',4,570,630,${W});   -- Fri 09:30 clashes with g3-a P2 only
  `);
}

function reset() {
  client.exec(`
    DELETE FROM allocations; DELETE FROM history; DELETE FROM drafts; DELETE FROM draft_allocations;
    DELETE FROM waitlist; DELETE FROM swap_requests; DELETE FROM preferences; DELETE FROM students;
    INSERT INTO students (id, name) VALUES ('me','Me'), ('s2','S2'), ('s3','S3');
  `);
}
const give = (student: string, group: string, option: string) =>
  client.prepare("INSERT INTO allocations (student_id, group_id, option_id) VALUES (?,?,?)").run(student, group, option);
const alloc = () => Object.fromEntries(svc.loadAllocation(ME));
const mv = (groupId: string, fromOptionId: string | null, toOptionId: string | null) => ({ groupId, fromOptionId, toOptionId });

beforeAll(insertCatalog);
beforeEach(reset);

describe("reads", () => {
  it("loads the catalog with sessions ordered and indexed", () => {
    const c = svc.loadCatalog();
    expect(c.courses.get("c1")?.groups.map((g) => g.id).sort()).toEqual(["g1", "g4"]);
    expect(c.options.get("g3-a")?.sessions.map((s) => s.part)).toEqual(["P1", "P2"]);
    expect(c.options.get("g1-c")?.capacity).toBeNull();
    expect(c.terms.get("t")?.breakAfterWeek).toBe(6);
  });
  it("counts seats from allocations", () => {
    give("s2", "g1", "g1-a");
    give(ME, "g1", "g1-a");
    expect(svc.seatsUsed().get("g1-a")).toBe(2);
  });
});

describe("selectOption", () => {
  it("takes a seat, replaces the group's option, writes one history row and emits after commit", () => {
    give(ME, "g1", "g1-a");
    const events: unknown[] = [];
    const on = (e: unknown) => events.push(e);
    bus.on(ALLOC_CHANGED, on);
    const r = svc.selectOption(ME, "g1-d");
    bus.off(ALLOC_CHANGED, on);
    expect(r.ok).toBe(true);
    expect(alloc()).toEqual({ g1: "g1-d" });
    const h = svc.loadHistory(ME);
    expect(h).toHaveLength(1);
    expect(h[0].entries).toEqual([expect.objectContaining({ groupId: "g1", fromOptionId: "g1-a", toOptionId: "g1-d" })]);
    expect(events).toHaveLength(1);
  });

  it("does not emit on failure", () => {
    give("s2", "g1", "g1-b");
    let n = 0;
    const on = () => n++;
    bus.on(ALLOC_CHANGED, on);
    const r = svc.selectOption(ME, "g1-b");
    bus.off(ALLOC_CHANGED, on);
    expect(r).toMatchObject({ ok: false, code: "full" });
    expect(n).toBe(0);
  });

  it("re-checks the last seat: second student loses, allocation unchanged", () => {
    expect(svc.selectOption("s2", "g1-b").ok).toBe(true);
    const r = svc.selectOption(ME, "g1-b");
    expect(r).toMatchObject({ ok: false, code: "full" });
    expect(alloc()).toEqual({});
    expect(svc.seatsUsed().get("g1-b")).toBe(1);
  });

  it("capacity null is never full", () => {
    for (const s of ["me", "s2", "s3"]) expect(svc.selectOption(s, "g1-c").ok).toBe(true);
    expect(svc.seatsUsed().get("g1-c")).toBe(3);
  });

  it("selecting what you already hold is an idempotent no-op even when full", () => {
    svc.selectOption(ME, "g1-b");
    const r = svc.selectOption(ME, "g1-b");
    expect(r).toEqual({ ok: true, batchId: null, moves: [] });
    expect(svc.loadHistory(ME)).toHaveLength(1);
  });

  it("refuses a clash with the clash details, unless forced", () => {
    give(ME, "g1", "g1-a");
    const r = svc.selectOption(ME, "g2-a");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("clash");
      expect(r.clashes?.[0]).toMatchObject({ optionA: "g2-a", optionB: "g1-a" });
    }
    expect(alloc()).toEqual({ g1: "g1-a" });
    expect(svc.selectOption(ME, "g2-a", { force: true }).ok).toBe(true);
    expect(alloc()).toEqual({ g1: "g1-a", g2: "g2-a" });
  });

  it("reports 'full' before 'clash' when an option is both", () => {
    give(ME, "g2", "g2-a");
    give("s2", "g1", "g1-a");
    give("s3", "g1", "g1-a"); // g1-a (cap 2) now full and clashes with g2-a
    expect(svc.selectOption(ME, "g1-a")).toMatchObject({ ok: false, code: "full" });
  });

  it("swapping within a group does not clash with the option being replaced", () => {
    give(ME, "g1", "g1-a");
    // g1-d is Fri 13:00; g1-a's own slot must not count against it, and g2-a is not held
    expect(svc.selectOption(ME, "g1-d").ok).toBe(true);
  });

  it("is atomic across parts: a multi-part option clashing in one part only is refused whole", () => {
    give(ME, "g4", "g4-a");
    const r = svc.selectOption(ME, "g3-a"); // P1 fine, P2 clashes with g4-a
    expect(r).toMatchObject({ ok: false, code: "clash" });
    expect(alloc()).toEqual({ g4: "g4-a" });
  });

  it("unknown option is not_found", () => {
    expect(svc.selectOption(ME, "nope")).toMatchObject({ ok: false, code: "not_found" });
  });

  it("tolerates an already-clashing timetable when unrelated groups change", () => {
    give(ME, "g1", "g1-a");
    give(ME, "g2", "g2-a"); // existing clash
    expect(svc.selectOption(ME, "g3-a").ok).toBe(true);
  });
});

describe("dropGroup + history batching", () => {
  it("drops and records the row", () => {
    give(ME, "g2", "g2-a");
    expect(svc.dropGroup(ME, "g2").ok).toBe(true);
    expect(alloc()).toEqual({});
    expect(svc.loadHistory(ME)[0].entries[0]).toMatchObject({ fromOptionId: "g2-a", toOptionId: null });
  });

  it("a moveBatch shares one batchId across all rows and marks the newest undoable", () => {
    give(ME, "g1", "g1-a");
    give(ME, "g2", "g2-a");
    const r = svc.moveBatch(ME, [mv("g1", "g1-a", "g1-d"), mv("g2", "g2-a", "g2-b")]);
    expect(r.ok).toBe(true);
    const rows = client.prepare("SELECT batch_id FROM history").all() as { batch_id: string }[];
    expect(new Set(rows.map((x) => x.batch_id)).size).toBe(1);
    const h = svc.loadHistory(ME);
    expect(h).toHaveLength(1);
    expect(h[0].entries).toHaveLength(2);
    expect(h[0].undoable).toBe(true);
  });
});

describe("moveBatch joint validation", () => {
  it("moving blocker away then taking A in one batch succeeds (final state clash-free)", () => {
    give(ME, "g1", "g1-a");
    // taking g2-a alone clashes; with g1 moved away in the same batch it does not
    expect(svc.selectOption(ME, "g2-a")).toMatchObject({ ok: false, code: "clash" });
    const r = svc.moveBatch(ME, [mv("g1", "g1-a", "g1-d"), mv("g2", null, "g2-a")]);
    expect(r.ok).toBe(true);
    expect(alloc()).toEqual({ g1: "g1-d", g2: "g2-a" });
  });

  it("refuses the whole batch when one part is full, leaving nothing half-applied", () => {
    give("s2", "g1", "g1-b");
    give(ME, "g2", "g2-a");
    const r = svc.moveBatch(ME, [mv("g2", "g2-a", "g2-b"), mv("g1", null, "g1-b")]);
    expect(r).toMatchObject({ ok: false, code: "full" });
    expect(alloc()).toEqual({ g2: "g2-a" });
    expect(svc.loadHistory(ME)).toHaveLength(0);
  });

  it("refuses a batch whose moved options clash with each other", () => {
    const r = svc.moveBatch(ME, [mv("g1", null, "g1-a"), mv("g2", null, "g2-a")]);
    expect(r).toMatchObject({ ok: false, code: "clash" });
    expect(alloc()).toEqual({});
  });

  it("fails stale when a stated from no longer matches", () => {
    give(ME, "g2", "g2-b");
    expect(svc.moveBatch(ME, [mv("g2", "g2-a", "g2-a")])).toMatchObject({ ok: false, code: "stale" });
  });

  it("rejects empty and duplicate-group batches and mismatched option/group", () => {
    expect(svc.moveBatch(ME, [])).toMatchObject({ ok: false, code: "invalid" });
    expect(svc.moveBatch(ME, [mv("g1", null, "g1-a"), mv("g1", null, "g1-d")])).toMatchObject({ ok: false, code: "invalid" });
    expect(svc.moveBatch(ME, [mv("g1", null, "g2-a")])).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("undo", () => {
  it("reverses the newest batch as a new undo batch and links both", () => {
    give(ME, "g1", "g1-a");
    const first = svc.selectOption(ME, "g1-d");
    expect(first.ok).toBe(true);
    const u = svc.undoLatest(ME);
    expect(u.ok).toBe(true);
    expect(alloc()).toEqual({ g1: "g1-a" });
    const h = svc.loadHistory(ME);
    expect(h[0]).toMatchObject({ source: "undo", undoesBatchId: first.ok ? first.batchId : "" });
    expect(h[1].undoneByBatchId).toBe(h[0].batchId);
    expect(h.some((b) => b.undoable)).toBe(false);
  });

  it("nothing to undo, and an undo cannot be undone", () => {
    expect(svc.undoLatest(ME)).toMatchObject({ ok: false, code: "nothing_to_undo" });
    svc.selectOption(ME, "g1-d");
    svc.undoLatest(ME);
    expect(svc.undoLatest(ME)).toMatchObject({ ok: false, code: "nothing_to_undo" });
  });

  it("walks back through several batches", () => {
    svc.selectOption(ME, "g1-d");
    svc.selectOption(ME, "g2-b");
    svc.undoLatest(ME);
    expect(alloc()).toEqual({ g1: "g1-d" });
    svc.undoLatest(ME);
    expect(alloc()).toEqual({});
  });

  it("fails 'full' when the option to restore is now full, changing nothing", () => {
    give(ME, "g1", "g1-b"); // cap 1
    expect(svc.dropGroup(ME, "g1").ok).toBe(true);
    give("s2", "g1", "g1-b"); // someone else takes the freed seat
    const r = svc.undoLatest(ME);
    expect(r).toMatchObject({ ok: false, code: "full" });
    expect(alloc()).toEqual({});
    expect(svc.loadHistory(ME)).toHaveLength(1);
    expect(svc.loadHistory(ME)[0].undoneByBatchId).toBeNull();
  });

  it("fails 'stale' when the timetable moved on since the batch", () => {
    svc.selectOption(ME, "g1-d");
    const first = svc.loadHistory(ME)[0].batchId;
    client.prepare("UPDATE allocations SET option_id = 'g1-a' WHERE student_id = 'me' AND group_id = 'g1'").run();
    expect(svc.undoLatest(ME, first)).toMatchObject({ ok: false, code: "stale" });
  });

  it("undoes a whole multi-group batch together, restoring an existing clash is allowed", () => {
    give(ME, "g1", "g1-a");
    give(ME, "g2", "g2-a"); // clashing pair
    svc.moveBatch(ME, [mv("g1", "g1-a", "g1-d")]);
    expect(svc.undoLatest(ME).ok).toBe(true);
    expect(alloc()).toEqual({ g1: "g1-a", g2: "g2-a" });
  });
});

describe("drafts", () => {
  it("has at most one open draft and overlays without history or seat checks", () => {
    give("s2", "g1", "g1-b");
    const d = svc.newDraft(ME, "What if");
    expect(svc.newDraft(ME).id).toBe(d.id);
    expect(svc.getOpenDraft(ME)?.name).toBe("What if");
    const r = svc.selectOption(ME, "g1-b", { draftId: d.id }); // full, but drafts don't check seats
    expect(r.ok).toBe(true);
    expect(svc.loadDraftOverlay(d.id).get("g1")).toBe("g1-b");
    expect(alloc()).toEqual({});
    expect(svc.loadHistory(ME)).toHaveLength(0);
    expect(svc.seatsUsed().get("g1-b")).toBe(1);
  });

  it("stores a drop as null and removes the overlay row when a change reverts to real", () => {
    give(ME, "g2", "g2-a");
    const d = svc.newDraft(ME);
    svc.dropGroup(ME, "g2", { draftId: d.id });
    expect(svc.loadDraftOverlay(d.id).get("g2")).toBeNull();
    svc.selectOption(ME, "g2-a", { draftId: d.id });
    expect(svc.loadDraftOverlay(d.id).has("g2")).toBe(false);
  });

  it("applies the diff as ONE draft batch and marks it applied", () => {
    give(ME, "g1", "g1-a");
    const d = svc.newDraft(ME);
    svc.selectOption(ME, "g1-d", { draftId: d.id });
    svc.selectOption(ME, "g2-b", { draftId: d.id });
    const r = svc.applyDraft(ME, d.id);
    expect(r.ok).toBe(true);
    expect(alloc()).toEqual({ g1: "g1-d", g2: "g2-b" });
    const h = svc.loadHistory(ME);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ source: "draft" });
    expect(h[0].entries).toHaveLength(2);
    expect(svc.getOpenDraft(ME)).toBeNull();
    expect(svc.applyDraft(ME, d.id)).toMatchObject({ ok: false, code: "no_draft" });
  });

  it("revalidates seats on apply and leaves the draft open when it fails", () => {
    const d = svc.newDraft(ME);
    svc.selectOption(ME, "g1-b", { draftId: d.id });
    give("s2", "g1", "g1-b");
    expect(svc.applyDraft(ME, d.id)).toMatchObject({ ok: false, code: "full" });
    expect(alloc()).toEqual({});
    expect(svc.getOpenDraft(ME)?.id).toBe(d.id);
  });

  it("revalidates clashes on apply (real timetable changed meanwhile)", () => {
    const d = svc.newDraft(ME);
    svc.selectOption(ME, "g2-a", { draftId: d.id });
    give(ME, "g1", "g1-a");
    expect(svc.applyDraft(ME, d.id)).toMatchObject({ ok: false, code: "clash" });
  });

  it("discard marks it discarded; further writes fail no_draft; restore brings it back with its changes", () => {
    const d = svc.newDraft(ME);
    svc.selectOption(ME, "g2-b", { draftId: d.id });
    expect(svc.discardDraft(ME, d.id).ok).toBe(true);
    expect(svc.getOpenDraft(ME)).toBeNull();
    expect(alloc()).toEqual({});
    expect(svc.selectOption(ME, "g2-b", { draftId: d.id })).toMatchObject({ ok: false, code: "no_draft" });
    expect(svc.discardDraft(ME, d.id)).toMatchObject({ ok: false, code: "no_draft" });
    // undo the discard: the draft and its overlay come back; a second restore has nothing to restore
    expect(svc.restoreDraft(ME, d.id).ok).toBe(true);
    expect(svc.getOpenDraft(ME)?.id).toBe(d.id);
    expect(svc.loadDraftOverlay(d.id).get("g2")).toBe("g2-b");
    expect(svc.restoreDraft(ME, d.id)).toMatchObject({ ok: false, code: "no_draft" });
    expect(svc.discardDraft(ME, d.id).ok).toBe(true);
  });

  it("restore refuses while another draft is open", () => {
    const d1 = svc.newDraft(ME);
    expect(svc.discardDraft(ME, d1.id).ok).toBe(true);
    const d2 = svc.newDraft(ME);
    expect(svc.restoreDraft(ME, d1.id)).toMatchObject({ ok: false, code: "invalid" });
    expect(svc.discardDraft(ME, d2.id).ok).toBe(true);
  });

  it("another student's draft is not usable", () => {
    const d = svc.newDraft("s2");
    expect(svc.selectOption(ME, "g2-b", { draftId: d.id })).toMatchObject({ ok: false, code: "no_draft" });
  });
});

describe("waitlist and swap", () => {
  it("only lets you join for a full option, idempotently", () => {
    give("s2", "g1", "g1-b");
    expect(svc.joinWaitlist(ME, "g1-d")).toMatchObject({ ok: false, code: "invalid" });
    expect(svc.joinWaitlist(ME, "g1-c")).toMatchObject({ ok: false, code: "invalid" }); // unlimited
    expect(svc.joinWaitlist(ME, "g1-b").ok).toBe(true);
    expect(svc.joinWaitlist(ME, "g1-b").ok).toBe(true);
    expect(svc.loadWaitlist(ME)).toHaveLength(1);
    expect(svc.joinWaitlist(ME, "zzz")).toMatchObject({ ok: false, code: "not_found" });
  });

  it("records one open swap request per identical ask, needs a held option", () => {
    expect(svc.requestSwap(ME, "g1", "g1-b")).toMatchObject({ ok: false, code: "invalid" });
    give(ME, "g1", "g1-a");
    expect(svc.requestSwap(ME, "g1", "g1-a")).toMatchObject({ ok: false, code: "invalid" });
    expect(svc.requestSwap(ME, "g1", "g2-a")).toMatchObject({ ok: false, code: "invalid" });
    expect(svc.requestSwap(ME, "g1", "g1-b").ok).toBe(true);
    expect(svc.requestSwap(ME, "g1", "g1-b").ok).toBe(true);
    expect(svc.loadSwapRequests(ME)).toEqual([expect.objectContaining({ haveOptionId: "g1-a", wantOptionId: "g1-b", status: "open" })]);
  });
});

describe("prefs", () => {
  it("returns defaults, rejects garbage, round-trips", () => {
    const def = svc.loadPrefs(ME);
    expect(def.daysOff).toEqual([]);
    expect(svc.savePrefs(ME, [1, 2])).toMatchObject({ ok: false, code: "invalid" });
    expect(svc.savePrefs(ME, "not json")).toMatchObject({ ok: false, code: "invalid" });
    const saved = svc.savePrefs(ME, { ...def, daysOff: [4] });
    expect(saved.ok).toBe(true);
    expect(svc.loadPrefs(ME).daysOff).toEqual([4]);
  });
});

describe("autofix", () => {
  it("previews without writing and confirms as one autofix batch", () => {
    give(ME, "g1", "g1-a");
    give(ME, "g2", "g2-a"); // clash
    const p = svc.autofixPreview(ME);
    expect(p.result.solved).toBe(true);
    expect(p.result.moves.length).toBe(1);
    expect(svc.loadHistory(ME)).toHaveLength(0);
    const r = svc.autofixConfirm(ME, p.basis);
    expect(r.ok).toBe(true);
    const h = svc.loadHistory(ME);
    expect(h).toHaveLength(1);
    expect(h[0].source).toBe("autofix");
    expect(svc.autofixPreview(ME).result.alreadyClean).toBe(true);
  });

  it("fails 'stale' when the allocation changed after the preview", () => {
    give(ME, "g1", "g1-a");
    give(ME, "g2", "g2-a");
    const p = svc.autofixPreview(ME);
    svc.selectOption(ME, "g3-a");
    expect(svc.autofixConfirm(ME, p.basis)).toMatchObject({ ok: false, code: "stale" });
    expect(alloc()).toEqual({ g1: "g1-a", g2: "g2-a", g3: "g3-a" });
  });
});
