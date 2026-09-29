import { clashesFor } from "./clash";
import type {
  Allocation,
  BlockerPlan,
  Candidate,
  Catalog,
  ClashDetail,
  Option,
  ResolvePlan,
  SeatsUsed,
} from "./types";

function candidate(opt: Option, newClashes: ClashDetail[], seats: SeatsUsed): Candidate {
  const used = seats.get(opt.id) ?? 0;
  return {
    optionId: opt.id,
    safe: newClashes.length === 0,
    newClashes,
    full: opt.capacity !== null && used >= opt.capacity,
    seatsLeft: opt.capacity === null ? null : Math.max(0, opt.capacity - used),
  };
}

function sortCandidates(list: Candidate[], catalog: Catalog): Candidate[] {
  const code = (id: string) => catalog.options.get(id)?.code ?? id;
  return list.sort(
    (x, y) =>
      Number(y.safe) - Number(x.safe) ||
      Number(x.full) - Number(y.full) ||
      code(x.optionId).localeCompare(code(y.optionId), undefined, { numeric: true }),
  );
}

/**
 * Given the wanted option A, return clash-free alternatives in A's group and, for each blocker B
 * (allocated options A clashes with), the options B could move to. Every candidate is checked with A
 * tentatively chosen and B's old slot removed (cascades caught); unsafe candidates are kept, flagged.
 * Safe candidates sort first, then non-full, then by option code.
 *
 * The student's own current option in a group is never offered as a destination for that group
 * (it is where they already are), so it is excluded from full checks by omission.
 */
export function resolveClash(
  optionId: string,
  alloc: Allocation,
  catalog: Catalog,
  seats: SeatsUsed,
): ResolvePlan {
  const a = catalog.options.get(optionId);
  if (!a) throw new Error(`resolveClash: unknown option ${optionId}`);
  const groupA = catalog.groups.get(a.groupId);
  if (!groupA) throw new Error(`resolveClash: unknown group ${a.groupId}`);

  const clashes = clashesFor(optionId, alloc, catalog);

  const currentA = alloc.get(a.groupId);
  const alternatives = sortCandidates(
    groupA.options
      .filter((o) => o.id !== optionId && o.id !== currentA)
      .map((o) => candidate(o, clashesFor(o.id, alloc, catalog), seats)),
    catalog,
  );

  // One blocker per clashing group.
  const blockerMoves: BlockerPlan[] = [];
  const seen = new Set<string>();
  for (const clash of clashes) {
    if (seen.has(clash.groupB)) continue;
    seen.add(clash.groupB);
    const blockerGroup = catalog.groups.get(clash.groupB);
    if (!blockerGroup) continue;
    // Plan in progress: A chosen (replacing whatever is in A's group), blocker's old slot removed.
    const plan: Allocation = new Map(alloc);
    plan.set(a.groupId, a.id);
    plan.delete(clash.groupB);
    const candidates = sortCandidates(
      blockerGroup.options
        .filter((o) => o.id !== clash.optionB)
        .map((o) => candidate(o, clashesFor(o.id, plan, catalog), seats)),
      catalog,
    );
    blockerMoves.push({
      groupId: clash.groupB,
      currentOptionId: clash.optionB,
      clash,
      candidates,
    });
  }

  return { optionId, groupId: a.groupId, clashes, alternatives, blockerMoves };
}
