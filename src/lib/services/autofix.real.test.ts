import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Allocation, Catalog, SeatsUsed } from "../engine/types";

let catalog: Catalog;
let real: Allocation;
let seats: SeatsUsed;
let autofix: typeof import("../engine/solve.ts").autofix;
let allClashes: typeof import("../engine/clash.ts").allClashes;

beforeAll(async () => {
  process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "autofix-real-")), "t.db");
  const load = await import("../seed/load.ts");
  load.seedIfEmpty({ log: () => {} });
  const svc = await import("./alloc.ts");
  catalog = svc.loadCatalog();
  real = svc.loadAllocation("me");
  seats = svc.seatsUsed();
  autofix = (await import("../engine/solve.ts")).autofix;
  allClashes = (await import("../engine/clash.ts")).allClashes;
});

const log = (msg: string) => process.stderr.write(`\n[autofix.real] ${msg}`);

describe("autofix on the real seed", () => {
  it("the student's real allocation: lecture clash is unsolvable (clones share the slot)", () => {
    expect(allClashes(real, catalog).length).toBeGreaterThan(0);
    const r = autofix(real, catalog, seats, null);
    log(`real: nodes=${r.nodes} capped=${r.capped}`);
    expect(r.alreadyClean).toBe(false);
    expect(r.solved).toBe(false);
    expect(r.moves).toEqual([]);
    expect(r.capped).toBe(false);
    expect(r.nodes).toBeGreaterThan(0);
  });

  it("performance: heavily clashing Wednesday allocation, seats ignored", () => {
    const nasty: Allocation = new Map(real);
    nasty.set("comp3900-tuta", "comp3900-tuta-05"); // Wed 14:00-16:00
    nasty.set("comp4020-tuta", "comp4020-tuta-05"); // Wed 14:00-15:30
    nasty.set("finm1001-tuta", "finm1001-tuta-01"); // Wed 14:00-15:00
    expect(allClashes(nasty, catalog).length).toBeGreaterThanOrEqual(3);
    const empty: SeatsUsed = new Map();
    const t0 = performance.now();
    const r = autofix(nasty, catalog, empty, null);
    const ms = performance.now() - t0;
    log(`nasty (no seat limits): nodes=${r.nodes} ms=${ms.toFixed(1)} solved=${r.solved} capped=${r.capped} moves=${r.moves.length}`);
    expect(ms).toBeLessThan(2000);
    // The Tuesday lecture clash is still there and cannot be fixed, so this must report unsolved, not capped.
    expect(r.solved).toBe(false);
    expect(r.capped).toBe(false);
    expect(r.moves).toEqual([]);

    // Same mess with the lecture clash removed: solvable, and it must use as few moves as possible.
    const solvable = new Map(nasty);
    solvable.delete("comp4650-leca");
    const t1 = performance.now();
    const r2 = autofix(solvable, catalog, empty, null);
    const ms2 = performance.now() - t1;
    log(`nasty solvable: nodes=${r2.nodes} ms=${ms2.toFixed(1)} moves=${r2.moves.length}`);
    expect(ms2).toBeLessThan(2000);
    expect(r2.solved).toBe(true);
    expect(r2.moves.length).toBeGreaterThanOrEqual(2);
    expect(allClashes(r2.resulting, catalog)).toHaveLength(0);
    // Confirm minimality: no single-group change fixes it.
    let singleFix = false;
    for (const g of catalog.groups.values()) {
      for (const o of g.options) {
        const t = new Map(solvable);
        if (t.has(g.id)) t.set(g.id, o.id);
        if (allClashes(t, catalog).length === 0) singleFix = true;
      }
    }
    expect(singleFix).toBe(false);
    const r3 = autofix(nasty, catalog, seats, null);
    log(`nasty (real seats): nodes=${r3.nodes} solved=${r3.solved} capped=${r3.capped}`);
  });

  it("a genuine one-move fix on real data", () => {
    const held: Allocation = new Map(real);
    held.delete("comp4650-leca"); // not enrolled, so the unsolvable lecture clash is out of the picture
    held.set("comp3900-tuta", "comp3900-tuta-06"); // Wed 16:00-17:30 (+ P2 17:30-18:00)
    held.set("finm1001-tuta", "finm1001-tuta-07"); // Wed 16:00-17:00
    expect(allClashes(held, catalog).length).toBeGreaterThan(0);
    const t0 = performance.now();
    const r = autofix(held, catalog, seats, null);
    log(`genuine: nodes=${r.nodes} ms=${(performance.now() - t0).toFixed(1)} moves=${r.moves.map((m) => `${m.groupId}:${m.toOptionId}`).join(",")}`);
    expect(r.solved).toBe(true);
    expect(r.moves).toHaveLength(1);
    expect(r.capped).toBe(false);
    expect(allClashes(r.resulting, catalog)).toHaveLength(0);
    for (const m of r.moves) {
      const o = catalog.options.get(m.toOptionId!)!;
      expect(o.capacity === null || o.capacity - (seats.get(o.id) ?? 0) > 0).toBe(true);
    }
  });
});
