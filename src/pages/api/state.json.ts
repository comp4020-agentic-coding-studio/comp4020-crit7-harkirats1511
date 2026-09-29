import type { APIRoute } from "astro";

// Stub: workstream E implements GET. Contract: JSON snapshot {allocation, seats, clashes} for tests and the second-tab refresh
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ error: "not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
