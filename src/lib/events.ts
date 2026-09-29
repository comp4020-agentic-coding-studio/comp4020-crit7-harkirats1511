import { EventEmitter } from "node:events";

// One process, one bus: every open SSE connection subscribes here. This only works because the app runs
// on exactly one machine (see fly.toml) — a second machine would have its own
// bus and clients would miss events.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

/** Payload of the "alloc-changed" event, broadcast after every committed mutation. */
export interface AllocChanged {
  studentId: string;
  /** Batch id written to history (null for draft-only changes). */
  batchId: string | null;
  /** Source label, same vocabulary as history.source, or "draft". */
  source: string;
}

export const ALLOC_CHANGED = "alloc-changed";

export function emitAllocChanged(payload: AllocChanged): void {
  bus.emit(ALLOC_CHANGED, payload);
}
