import type { ValidateOptions } from "./validate";

/** Default seed file path, relative to the repo root (Dockerfile must copy it). */
export const SEED_PATH = "seed/sem2-2026.json";

/**
 * Idempotent: if the `terms` table is empty, validate SEED_PATH and insert term, courses, aliases, groups,
 * options, sessions, the student and placeholder students (`enrolled`) with their allocations, all in one
 * transaction; otherwise do nothing. Safe to call on every boot and from spec/global-setup.ts (which sets
 * DATABASE_PATH first). Returns true if it inserted. Throws with all "path: message" errors if invalid.
 */
export function seedIfEmpty(opts?: ValidateOptions & { path?: string }): boolean {
  throw new Error("not implemented: seedIfEmpty");
}
