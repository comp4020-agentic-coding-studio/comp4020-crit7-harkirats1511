import type { Catalog, Day, Group, Option, Session } from "./types";
import { parseWeeks } from "./weeks";

export const t = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export interface SessSpec {
  part?: string;
  day: Day;
  start: string;
  end: string;
  weeks: string;
  exempt?: boolean;
}
export interface OptSpec {
  id: string;
  code?: string;
  capacity?: number | null;
  sessions: SessSpec[];
}
export interface GroupSpec {
  id: string;
  exempt?: boolean;
  options: OptSpec[];
}

export function makeCatalog(groups: GroupSpec[]): Catalog {
  const cat: Catalog = {
    terms: new Map(),
    courses: new Map(),
    groups: new Map(),
    options: new Map(),
    groupsByCourse: new Map(),
  };
  for (const g of groups) {
    const options: Option[] = g.options.map((o) => ({
      id: o.id,
      groupId: g.id,
      code: o.code ?? o.id,
      capacity: o.capacity === undefined ? 10 : o.capacity,
      campus: null,
      staff: null,
      overflow: false,
      sessions: o.sessions.map(
        (s, i): Session => ({
          id: `${o.id}-s${i}`,
          optionId: o.id,
          part: s.part ?? `P${i + 1}`,
          day: s.day,
          startMin: t(s.start),
          endMin: t(s.end),
          weeks: parseWeeks(s.weeks),
          location: null,
          exempt: s.exempt ?? false,
        }),
      ),
    }));
    const group: Group = {
      id: g.id,
      courseId: "c",
      kind: "tutorial",
      name: g.id,
      exemptFromClash: g.exempt ?? false,
      options,
    };
    cat.groups.set(g.id, group);
    for (const o of options) cat.options.set(o.id, o);
  }
  cat.groupsByCourse.set("c", groups.map((g) => g.id));
  return cat;
}
