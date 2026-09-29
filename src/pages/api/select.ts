import type { APIRoute } from "astro";

// Stub: workstream E implements POST. Contract: form POST {optionId, draftId?}; select option; 303 back to Referer/course page (?error= on failure)
export const POST: APIRoute = () =>
  new Response(JSON.stringify({ error: "not implemented" }), {
    status: 501,
    headers: { "content-type": "application/json" },
  });
