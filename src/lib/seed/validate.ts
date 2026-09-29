import type { SeedFile } from "./schema";

export interface ValidateOptions {
  /** Reject "TODO" markers (used by `pnpm db:seed --strict`). Default false (draft mode). */
  strict?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  /** One "path: message" string per problem, e.g. "courses.1.groups.0.options.2.sessions.0.start: expected HH:MM". */
  errors: string[];
  /** Parsed seed when ok. */
  seed?: SeedFile;
}

/**
 * Parse with seedFile, then semantic checks: parseable weeks within 1..13, start < end, unique ids/codes,
 * enrolled <= capacity, allocations reference existing options, TODO markers rejected when strict.
 */
export function validateSeed(json: unknown, opts?: ValidateOptions): ValidationResult {
  throw new Error("not implemented: validateSeed");
}
