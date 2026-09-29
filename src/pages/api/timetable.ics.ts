import type { APIRoute } from "astro";

// Stub: workstream E implements GET. Contract: text/calendar of the student's allocation via engine buildIcs
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ error: "not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
