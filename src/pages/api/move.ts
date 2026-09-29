import type { APIRoute } from "astro";

// Stub: workstream E implements POST. Contract: form POST {moves: JSON Move[] or fromOptionId/toOptionId pairs, source?}; one atomic batch; 303
export const POST: APIRoute = () =>
  new Response(JSON.stringify({ error: "not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
