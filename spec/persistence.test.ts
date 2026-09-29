import { afterAll, describe, expect, inject, it } from "vitest";

// Contract: the core flow persists. A same-origin form POST changes the student's allocation, and a FRESH request
// (what a reload does) still shows it. All tests share one temp DB and other spec files run in parallel, so this
// file only mutates FINM1001 TutA, FINM1001 LecA, COMP4650 LecA and COMP4650 ComA, and restores what it changes.
const baseUrl = inject("baseUrl");

const post = (path: string, form: Record<string, string> = {}) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { origin: baseUrl, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });

type State = { allocation: unknown; seats: Record<string, unknown> };
const state = async (): Promise<State> => {
  const res = await fetch(new URL("/api/state.json", baseUrl), { headers: { "cache-control": "no-cache" } });
  expect(res.status).toBe(200);
  return (await res.json()) as State;
};

// allocation may serialise as {groupId: optionId}, {groupId: {optionId}} or [[groupId, optionId]]
const allocOf = (s: State): Record<string, string> => {
  const raw = s.allocation as unknown;
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

// seats may be a number, or an object carrying used/free per option; only deltas are compared
const seatOf = (s: State, optionId: string): number => {
  const v = s.seats[optionId] as unknown;
  if (typeof v === "number") return v;
  const o = (v ?? {}) as { used?: number; free?: number; left?: number; seatsLeft?: number };
  return o.used ?? o.free ?? o.left ?? o.seatsLeft ?? Number.NaN;
};

const location = (res: Response) => res.headers.get("location") ?? "";

describe("core flow persists across a reload", () => {
  afterAll(async () => {
    await post("/api/select", { optionId: "finm1001-tuta-03" });
    await post("/api/select", { optionId: "comp4650-coma-03" });
    await post("/api/select", { optionId: "comp4650-leca-01", force: "1" });
    await post("/api/select", { optionId: "finm1001-leca-01", force: "1" });
  });

  it("(a) selecting FINM1001 TutA 07 is a 303 and a fresh read shows it, with seats moved by one", async () => {
    const before = await state();
    expect(allocOf(before)["finm1001-tuta"]).toBe("finm1001-tuta-03");
    const res = await post("/api/select", { optionId: "finm1001-tuta-07" });
    expect(res.status).toBe(303);
    expect(location(res)).not.toMatch(/error/i);

    const after = await state();
    expect(allocOf(after)["finm1001-tuta"]).toBe("finm1001-tuta-07");
    const d07 = seatOf(after, "finm1001-tuta-07") - seatOf(before, "finm1001-tuta-07");
    const d03 = seatOf(after, "finm1001-tuta-03") - seatOf(before, "finm1001-tuta-03");
    expect(Math.abs(d07)).toBe(1);
    expect(d03).toBe(-d07);

    const page = await fetch(new URL("/timetable/", baseUrl));
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("FINM1001");
    expect(html).toMatch(/16:00/);
    // restore at once: COMP3900 TutA 06 (clash-flow) would genuinely clash with a held Wed 16:00 tutorial
    await post("/api/select", { optionId: "finm1001-tuta-03" });
  });

  it("(b) dropping a group persists in state.json", async () => {
    const res = await post("/api/drop", { groupId: "comp4650-leca" });
    expect(res.status).toBe(303);
    expect(allocOf(await state())["comp4650-leca"]).toBeUndefined();
    const restore = await post("/api/select", { optionId: "comp4650-leca-01", force: "1" });
    expect(restore.status).toBe(303);
    expect(allocOf(await state())["comp4650-leca"]).toBe("comp4650-leca-01");
  });

  it("(c) a full option is refused: allocation unchanged, redirect carries an error", async () => {
    const before = await state();
    const res = await post("/api/select", { optionId: "comp4020-tuta-05" });
    expect(res.status).toBe(303);
    expect(location(res)).toMatch(/error/i);
    const after = await state();
    expect(allocOf(after)["comp4020-tuta"]).toBe(allocOf(before)["comp4020-tuta"]);
    expect(seatOf(after, "comp4020-tuta-05")).toBe(seatOf(before, "comp4020-tuta-05"));
  });

  it("(d) a multi-part option is taken whole or not at all", async () => {
    // COMP4650 ComA 05 = P1 Fri 11:00-12:30 + drop-in P2 12:30-13:00 (1 seat free, clashes with nothing)
    const before = await state();
    const res = await post("/api/select", { optionId: "comp4650-coma-05" });
    expect(res.status).toBe(303);
    const after = await state();
    const now = allocOf(after)["comp4650-coma"];
    expect(["comp4650-coma-03", "comp4650-coma-05"]).toContain(now);
    // seats are per option (not per part): exactly the held option gained a seat, the other lost one
    const d05 = seatOf(after, "comp4650-coma-05") - seatOf(before, "comp4650-coma-05");
    const d03 = seatOf(after, "comp4650-coma-03") - seatOf(before, "comp4650-coma-03");
    if (now === "comp4650-coma-05") {
      expect(Math.abs(d05)).toBe(1);
      expect(d03).toBe(-d05);
    } else {
      expect(d05).toBe(0);
      expect(d03).toBe(0);
    }
    expect(now).toBe("comp4650-coma-05"); // nothing clashes, so it must in fact succeed
    await post("/api/select", { optionId: "comp4650-coma-03" });
    expect(allocOf(await state())["comp4650-coma"]).toBe("comp4650-coma-03");
  });

  it("(e) undo reverses the latest change and /history/ lists the batch", async () => {
    const drop = await post("/api/drop", { groupId: "finm1001-leca" });
    expect(drop.status).toBe(303);
    expect(allocOf(await state())["finm1001-leca"]).toBeUndefined();

    const undo = await post("/api/undo");
    expect(undo.status).toBe(303);
    expect(allocOf(await state())["finm1001-leca"]).toBe("finm1001-leca-01");

    const hist = await fetch(new URL("/history/", baseUrl));
    expect(hist.status).toBe(200);
    expect(await hist.text()).toMatch(/finm1001/i);
  });

  it("(f) key pages return 200 and show course codes", async () => {
    for (const [path, codes] of [
      ["/", ["COMP4020"]],
      ["/timetable/", ["COMP3900", "COMP4020", "COMP4650", "FINM1001"]],
      ["/course/COMP4020/", ["COMP4020"]],
    ] as const) {
      const res = await fetch(new URL(path, baseUrl));
      expect(res.status, path).toBe(200);
      const html = await res.text();
      for (const code of codes) expect(html, `${path} shows ${code}`).toContain(code);
    }
  });
});
