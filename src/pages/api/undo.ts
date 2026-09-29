import type { APIRoute } from "astro";

// Stub: workstream E implements POST. Contract: form POST {batchId?}; 303 to /history/
export const POST: APIRoute = () =>
  new Response(JSON.stringify({ error: "not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
