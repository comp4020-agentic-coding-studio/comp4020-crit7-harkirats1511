import { allClashes, optionClash } from "./clash";
import { scorePrefs } from "./prefs";
import type {
  Allocation,
  AutofixOptions,
  AutofixResult,
  Catalog,
  Move,
  Option,
  Prefs,
  SeatsUsed,
} from "./types";

/**
 * Branch-and-bound over all groups (clashing ones first): find a clash-free allocation with the fewest
 * moves (moves validated jointly), tie-break by best scorePrefs (skipped when prefs is null), stop at
 * opts.nodeCap and report `capped`. A destination is allowed when capacity is null or seatsLeft > 0.
 */
export function autofix(
  alloc: Allocation,
  catalog: Catalog,
  seats: SeatsUsed,
  prefs: Prefs | null,
  opts?: AutofixOptions,
): AutofixResult {
  const nodeCap = opts?.nodeCap ?? 200_000;
  const score = (a: Allocation) => (prefs ? scorePrefs(a, catalog, prefs) : null);
  const clashes = allClashes(alloc, catalog);
  if (clashes.length === 0) {
    return { moves: [], solved: true, alreadyClean: true, capped: false, nodes: 0, score: score(alloc), resulting: new Map(alloc) };
  }
  const failed = (capped: boolean, nodes: number): AutofixResult => ({
    moves: [], solved: false, alreadyClean: false, capped, nodes, score: score(alloc), resulting: new Map(alloc),
  });

  // Every allocated group may move. Clashing groups come first so conflicts prune early.
  const clashing = new Set(clashes.flatMap((c) => [c.groupA, c.groupB]));
  const vars = [...alloc.keys()]
    .filter((g) => catalog.options.has(alloc.get(g)!) && catalog.groups.has(g))
    .sort((a, b) => Number(clashing.has(b)) - Number(clashing.has(a)) || (a < b ? -1 : 1));
  const clashes2 = (a: Option, b: Option) => optionClash(a, b, catalog) !== null;
  // Domain per group: current option first, then non-full alternatives (own seat is not counted).
  const domains: Option[][] = vars.map((g) => {
    const cur = alloc.get(g)!;
    const dom: Option[] = [catalog.options.get(cur)!];
    for (const o of catalog.groups.get(g)!.options) {
      if (o.id === cur) continue;
      const left = o.capacity === null ? Infinity : o.capacity - (seats.get(o.id) ?? 0);
      if (left > 0) dom.push(o);
    }
    return dom;
  });

  const compatCache = new Map<string, boolean>();
  const compat = (a: Option, b: Option) => {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    let v = compatCache.get(key);
    if (v === undefined) {
      v = !clashes2(a, b);
      compatCache.set(key, v);
    }
    return v;
  };

  let nodes = 0;
  let capped = false;
  const n = vars.length;
  const chosen: Option[] = new Array(n);

  const build = (): Allocation => {
    const res = new Map(alloc);
    for (let i = 0; i < n; i++) res.set(vars[i], chosen[i].id);
    return res;
  };

  for (let k = 0; k <= n && !capped; k++) {
    let best: Allocation | null = null;
    let bestScore = Infinity;

    const dfs = (i: number, movesLeft: number) => {
      if (capped) return;
      if (i === n) {
        if (movesLeft !== 0) return;
        const res = build();
        if (!prefs) {
          if (!best) best = res;
          return;
        }
        const s = scorePrefs(res, catalog, prefs).total;
        if (s < bestScore) {
          bestScore = s;
          best = res;
        }
        return;
      }
      if (n - i < movesLeft) return;
      const dom = domains[i];
      for (let d = 0; d < dom.length; d++) {
        const isMove = d > 0;
        if (isMove && movesLeft === 0) break;
        if (++nodes > nodeCap) {
          capped = true;
          return;
        }
        const o = dom[d];
        let ok = true;
        for (let j = 0; j < i; j++) {
          if (!compat(o, chosen[j])) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        chosen[i] = o;
        dfs(i + 1, movesLeft - (isMove ? 1 : 0));
        if (capped) return;
        if (!prefs && best) return;
      }
    };
    dfs(0, k);

    if (best) {
      const res: Allocation = best;
      const moves: Move[] = [];
      for (const g of vars) {
        const from = alloc.get(g) ?? null;
        const to = res.get(g) ?? null;
        if (from !== to) moves.push({ groupId: g, fromOptionId: from, toOptionId: to });
      }
      return { moves, solved: true, alreadyClean: false, capped, nodes, score: score(res), resulting: res };
    }
  }
  return failed(capped, nodes);
}
