import type { APIRoute } from "astro";

// Stub: workstream E implements POST. Contract: form POST {basis}; confirms the previewed autofix; 303
export const POST: APIRoute = () =>
  new Response(JSON.stringify({ error: "not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
