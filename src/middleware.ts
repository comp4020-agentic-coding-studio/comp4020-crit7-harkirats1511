import { defineMiddleware } from "astro:middleware";
import { seedIfEmpty } from "./lib/seed/load.ts";

// A fresh deployment (empty Fly volume) must serve seeded data. Seed once per process, on the first real request
// (not at import: the build's prerender pass loads this module and must not touch a database). seedIfEmpty is a
// no-op once `terms` has a row, and a failure is logged rather than taking the server down.
let seeded = false;

export const onRequest = defineMiddleware((context, next) => {
  if (!seeded && !context.isPrerendered) {
    seeded = true;
    try {
      if (seedIfEmpty()) console.log("[seed] empty database seeded on first request");
    } catch (e) {
      console.error(`[seed] boot seeding failed, continuing with current data: ${(e as Error).message}`);
    }
  }
  return next();
});
