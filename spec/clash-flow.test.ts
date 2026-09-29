import { afterAll, describe, expect, inject, it } from "vitest";

// Contract: the resolve flow. COMP3900 TutA 04 (Wed 11:00-12:30 + drop-in 12:30-13:00, 2 seats free) clashes with the
// student's COMP4020 TutA 04 (Wed 10:30-12:00) for 60 min. Without force the select is refused and the student is
// sent to the resolve view /course/COMP3900/?pick=comp3900-tuta-04. Other spec files run in parallel against the same
// DB, so this file only mutates COMP3900 TutA and COMP3900 LecA, and restores them.
const baseUrl = inject("baseUrl");

const post = (path: string, form: Record<string, string> = {}) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { origin: baseUrl, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });

const alloc = async (): Promise<Record<string, string>> => {
  const s = (await (await fetch(new URL("/api/state.json", baseUrl))).json()) as { allocation: unknown };
  const raw = s.allocation;
  const out: Record<string, string> = {};
  const entries: [string, unknown][] = Array.isArray(raw)
    ? (raw as [string, unknown][])
    : Object.entries(raw as Record<string, unknown>);
  for (const [g, v] of entries) {
    const o = typeof v === "string" ? v : ((v as { optionId?: string } | null)?.optionId ?? "");
    if (o) out[g] = o;
  }
  return out;
};

const moves = (...m: [string, string | null, string | null][]) =>
  JSON.stringify(m.map(([groupId, fromOptionId, toOptionId]) => ({ groupId, fromOptionId, toOptionId })));

describe("resolve flow", () => {
  afterAll(async () => {
    await post("/api/select", { optionId: "comp3900-tuta-05" });
    await post("/api/select", { optionId: "comp3900-leca-01", force: "1" });
  });

  it("selecting a clashing option without force is refused and redirects to the resolve view", async () => {
    const before = await alloc();
    expect(before["comp4020-tuta"]).toBe("comp4020-tuta-04");
    const res = await post("/api/select", { optionId: "comp3900-tuta-04" });
    expect(res.status).toBe(303);
    const loc = res.headers.get("location") ?? "";
    expect(loc.toLowerCase()).toContain("/course/comp3900");
    expect(loc).toContain("pick=comp3900-tuta-04");
    const after = await alloc();
    expect(after["comp3900-tuta"]).toBe(before["comp3900-tuta"]);
    expect(after["comp3900-tuta"]).not.toBe("comp3900-tuta-04");
  });

  it("the resolve view names the blocker and offers alternatives and a blocker move", async () => {
    const res = await fetch(new URL("/course/COMP3900/?pick=comp3900-tuta-04", baseUrl));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("COMP4020");
    // clash-free alternatives for A's group are offered as selectable options (07 = Fri 09:00, clashes with nothing)
    expect(html).toContain("comp3900-tuta-07");
    // the blocker's group is offered for moving
    expect(html).toContain("comp4020-tuta");
  });

  it("a batch with a full target is refused as a whole", async () => {
    const before = await alloc();
    // blocker to option 03 (full) + A to 04: must not half-apply
    const res = await post("/api/move", {
      moves: moves(
        ["comp4020-tuta", "comp4020-tuta-04", "comp4020-tuta-03"],
        ["comp3900-tuta", before["comp3900-tuta"] ?? null, "comp3900-tuta-04"],
      ),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location") ?? "").toMatch(/error/i);
    expect(await alloc()).toEqual(before);
  });

  it("a batch that still clashes after the moves is refused as a whole", async () => {
    const before = await alloc();
    // A alone to 04 while the blocker stays: joint validation must reject, nothing applied
    const res = await post("/api/move", {
      moves: moves(["comp3900-tuta", before["comp3900-tuta"] ?? null, "comp3900-tuta-04"]),
    });
    expect(res.status).toBe(303);
    expect(await alloc()).toEqual(before);
  });

  it("a feasible two-group batch is applied atomically and persists", async () => {
    const before = await alloc();
    const res = await post("/api/move", {
      moves: moves(
        ["comp3900-tuta", before["comp3900-tuta"] ?? null, "comp3900-tuta-07"],
        ["comp3900-leca", before["comp3900-leca"] ?? null, "comp3900-leca-01_clone"],
      ),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location") ?? "").not.toMatch(/error/i);
    const after = await alloc(); // fresh request = reload
    expect(after["comp3900-tuta"]).toBe("comp3900-tuta-07");
    expect(after["comp3900-leca"]).toBe("comp3900-leca-01_clone");
    expect(after["comp4020-tuta"]).toBe("comp4020-tuta-04");
  });

  it("drop-ins never block: TutA 06 overlaps only the exempt COMP4650 DroB and is selectable", async () => {
    // COMP3900 TutA 06 = Wed 16:00-17:30 + drop-in 17:30-18:00; overlaps only DroB (Wed 15:00-17:00, exempt)
    const res = await post("/api/select", { optionId: "comp3900-tuta-06" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location") ?? "").not.toMatch(/error/i);
    expect((await alloc())["comp3900-tuta"]).toBe("comp3900-tuta-06");
    const s = (await (await fetch(new URL("/api/state.json", baseUrl))).json()) as { clashes?: unknown };
    expect(JSON.stringify(s.clashes ?? [])).not.toMatch(/drob/i);
  });
});
