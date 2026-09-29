import type { APIRoute } from "astro";
import { ALLOC_CHANGED, type AllocChanged, bus } from "../../lib/events";

// The minimal server-sent-events (SSE) pattern: a long-lived streaming
// response the browser consumes with `new EventSource("/api/events")`.
// SSE is one-directional (server → browser) and plain HTTP, which makes it
// the simplest live channel that works everywhere — reach for WebSockets
// only when the client needs to push over the same connection.
export const GET: APIRoute = () => {
  let onMessage: (change: AllocChanged) => void;
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<string>({
    start(controller) {
      // an opening comment so the client (and the post-deploy CI probe) sees
      // bytes immediately, and a periodic one so proxies don't drop the
      // connection as idle
      controller.enqueue(": connected\n\n");
      heartbeat = setInterval(() => controller.enqueue(": ping\n\n"), 30_000);
      onMessage = (change) => {
        controller.enqueue(`event: ${ALLOC_CHANGED}\ndata: ${JSON.stringify(change)}\n\n`);
      };
      bus.on(ALLOC_CHANGED, onMessage);
    },
    cancel() {
      clearInterval(heartbeat);
      bus.off(ALLOC_CHANGED, onMessage);
    },
  });

  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};
