import { DAY_NAMES, myttWeekList, type WeekTerm } from "./mytt-weeks.ts";
import { seedFile, type SeedFile, type SeedGroup } from "./schema.ts";

export interface ValidateOptions {
  /** Reject "TODO" markers (used by `pnpm db:seed --strict`). Default false (draft mode). */
  strict?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  /** One "path: message" string per problem, e.g. "courses.1.groups.0.options.2.sessions.0.start: expected HH:MM". */
  errors: string[];
  /** Non-fatal notes (draft mode): TODO groups and TODO weeks that the loader will skip. */
  warnings: string[];
  /** Parsed seed when ok. */
  seed?: SeedFile;
}

/** Slug used for ids not given explicitly: lowercase, non-alphanumerics (except "_") removed. */
export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9_]+/g, "");
}

export function courseIdOf(c: { id?: string; code: string }): string {
  return c.id ?? slug(c.code);
}
export function groupIdOf(courseId: string, g: { id?: string; name: string }): string {
  return g.id ?? `${courseId}-${slug(g.name)}`;
}
export function optionIdOf(groupId: string, o: { id?: string; code: string }): string {
  return o.id ?? `${groupId}-${slug(o.code)}`;
}
export function sessionIdOf(optionId: string, part: string): string {
  return `${optionId}-${slug(part)}`;
}

export function isTodoGroup(g: SeedGroup): boolean {
  return g.options === "TODO";
}

const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/**
 * Parse with seedFile, then semantic checks: parseable weeks (teaching or MyTT dates, via the converter) within the
 * term and not in the break, start < end, unique ids/codes, enrolled <= capacity, allocations reference existing
 * options, TODO markers rejected when strict.
 */
export function validateSeed(json: unknown, opts?: ValidateOptions): ValidationResult {
  const strict = opts?.strict === true;
  const parsed = seedFile.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      warnings: [],
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const seed = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const term = seed.term;
  const weekTerm: WeekTerm = {
    startDate: term.startDate,
    teachingWeeks: term.teachingWeeks,
    breakAfterWeek: term.breakAfterWeek,
  };

  const startDate = new Date(`${term.startDate}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || startDate.toISOString().slice(0, 10) !== term.startDate) {
    errors.push(`term.startDate: not a real date "${term.startDate}"`);
  } else if (startDate.getUTCDay() !== 1) {
    errors.push(`term.startDate: ${term.startDate} is not a Monday`);
  }
  if (term.breakAfterWeek !== null && (term.breakAfterWeek < 1 || term.breakAfterWeek >= term.teachingWeeks)) {
    errors.push(`term.breakAfterWeek: must be between 1 and ${term.teachingWeeks - 1}`);
  }

  const seen = { course: new Map<string, string>(), group: new Map<string, string>(), option: new Map<string, string>() };
  const unique = (kind: keyof typeof seen, id: string, path: string) => {
    const prev = seen[kind].get(id);
    if (prev) errors.push(`${path}: duplicate ${kind} id "${id}" (also at ${prev})`);
    else seen[kind].set(id, path);
  };
  const codes = new Set<string>();
  const optionByGroupCode = new Map<string, Set<string>>();

  seed.courses.forEach((course, ci) => {
    const cp = `courses.${ci}`;
    const cid = courseIdOf(course);
    unique("course", cid, cp);
    const codeKey = course.code.toLowerCase();
    if (codes.has(codeKey)) errors.push(`${cp}.code: duplicate course code "${course.code}"`);
    codes.add(codeKey);
    course.aliases.forEach((a, ai) => {
      if (a.toLowerCase() === codeKey) errors.push(`${cp}.aliases.${ai}: alias equals the course code`);
    });

    course.groups.forEach((group, gi) => {
      const gp = `${cp}.groups.${gi}`;
      const gid = groupIdOf(cid, group);
      unique("group", gid, gp);
      if (group.options === "TODO") {
        const msg = `${gp}.options: TODO (group ${gid} has no options yet)`;
        if (strict) errors.push(msg);
        else warnings.push(`${msg}; the loader will skip it`);
        return;
      }
      const codesInGroup = new Set<string>();
      optionByGroupCode.set(gid, codesInGroup);
      group.options.forEach((opt, oi) => {
        const op = `${gp}.options.${oi}`;
        const oid = optionIdOf(gid, opt);
        unique("option", oid, op);
        if (codesInGroup.has(opt.code.toLowerCase())) errors.push(`${op}.code: duplicate option code "${opt.code}" in group ${gid}`);
        codesInGroup.add(opt.code.toLowerCase());
        if (opt.capacity != null && opt.enrolled > opt.capacity) {
          errors.push(`${op}.enrolled: ${opt.enrolled} exceeds capacity ${opt.capacity}`);
        }
        const parts = new Set<string>();
        opt.sessions.forEach((ses, si) => {
          const sp = `${op}.sessions.${si}`;
          if (parts.has(ses.part.toLowerCase())) errors.push(`${sp}.part: duplicate part "${ses.part}" in option ${oid}`);
          parts.add(ses.part.toLowerCase());
          if (!(hm(ses.start) < hm(ses.end))) errors.push(`${sp}.end: end ${ses.end} must be after start ${ses.start}`);
          if (ses.weeks === "TODO") {
            const msg = `${sp}.weeks: TODO`;
            if (strict) errors.push(msg);
            else warnings.push(`${msg}; the loader will skip option ${oid}`);
            return;
          }
          try {
            const list = myttWeekList(ses.weeks, ses.day, weekTerm);
            if (list.length === 0) errors.push(`${sp}.weeks: no teaching weeks`);
          } catch (e) {
            errors.push(`${sp}.weeks: ${(e as Error).message}`);
          }
          if (!DAY_NAMES.includes(ses.day)) errors.push(`${sp}.day: unknown day`);
        });
      });
    });
  });

  seed.allocations.forEach((a, i) => {
    const ap = `allocations.${i}`;
    const codesInGroup = optionByGroupCode.get(a.group);
    if (!codesInGroup) {
      errors.push(
        seen.group.has(a.group)
          ? `${ap}.group: group "${a.group}" is a TODO group with no options`
          : `${ap}.group: no such group "${a.group}"`,
      );
    } else if (!codesInGroup.has(a.option.toLowerCase())) {
      errors.push(`${ap}.option: group "${a.group}" has no option "${a.option}"`);
    }
  });
  const allocatedGroups = new Set<string>();
  seed.allocations.forEach((a, i) => {
    if (allocatedGroups.has(a.group)) errors.push(`allocations.${i}.group: group "${a.group}" allocated twice`);
    allocatedGroups.add(a.group);
  });

  return errors.length ? { ok: false, errors, warnings, seed: undefined } : { ok: true, errors, warnings, seed };
}
