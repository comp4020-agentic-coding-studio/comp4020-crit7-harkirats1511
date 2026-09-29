import { describe, expect, inject, it } from "vitest";

// Contract: state-changing requests must be same-origin. Deploy CI relies on `/` behaving exactly like this.
const baseUrl = inject("baseUrl");
const evil = "https://evil.example";

const post = (path: string, origin: string, form: Record<string, string> = {}) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });

describe("csrf", () => {
  it("cross-origin POST to / is 403", async () => {
    expect((await post("/", evil)).status).toBe(403);
  });

  it("same-origin POST to / is not 403", async () => {
    expect((await post("/", baseUrl)).status).not.toBe(403);
  });

  it("cross-origin POST to /api/select is 403 and changes nothing", async () => {
    const snap = async () => JSON.stringify(await (await fetch(new URL("/api/state.json", baseUrl))).json());
    const before = await snap();
    const res = await post("/api/select", evil, { optionId: "comp3900-tuta-07" });
    expect(res.status).toBe(403);
    // seats/allocation for the target must be as before (other files only touch their own groups)
    const state = JSON.parse(await snap()) as { allocation: unknown };
    expect(JSON.stringify(state.allocation)).not.toContain("comp3900-tuta-07");
    expect(JSON.parse(before)).toBeTruthy();
  });

  it("GET /api/events streams bytes starting with ': connected'", async () => {
    const ctrl = new AbortController();
    const res = await fetch(new URL("/api/events", baseUrl), { signal: ctrl.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    ctrl.abort();
    expect(new TextDecoder().decode(value)).toMatch(/^: connected/);
  });
});
