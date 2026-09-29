import type { APIRoute } from "astro";
import { allClashes } from "../../lib/engine/clash";
import { DEFAULT_STUDENT_ID, loadAllocation, loadCatalog, seatsUsed } from "../../lib/services/alloc";

// GET: read-only JSON snapshot of the real allocation, for tests and the second-tab refresh.
// {studentId, allocation: {groupId: optionId}, groups: [{groupId, groupName, courseCode, optionId, optionCode,
//  capacity|null, seatsUsed, seatsLeft|null, clashes: [{withOptionId, withGroupId, weeks, totalMinutes}]}],
//  seats: {optionId: used}, clashes: [{optionA, optionB, groupA, groupB, weeks, totalMinutes, overlaps: [...]}]}
export const GET: APIRoute = () => {
  const catalog = loadCatalog();
  const alloc = loadAllocation(DEFAULT_STUDENT_ID);
  const seats = seatsUsed();
  const clashes = allClashes(alloc, catalog);
  const groups = [...alloc.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([groupId, optionId]) => {
      const group = catalog.groups.get(groupId);
      const opt = catalog.options.get(optionId);
      const used = seats.get(optionId) ?? 0;
      const cap = opt?.capacity ?? null;
      return {
        groupId,
        groupName: group?.name ?? null,
        courseCode: (group && catalog.courses.get(group.courseId)?.code) ?? null,
        optionId,
        optionCode: opt?.code ?? null,
        capacity: cap,
        seatsUsed: used,
        seatsLeft: cap === null ? null : Math.max(0, cap - used),
        clashes: clashes
          .filter((c) => c.groupA === groupId || c.groupB === groupId)
          .map((c) => {
            const mine = c.groupA === groupId;
            return {
              withOptionId: mine ? c.optionB : c.optionA,
              withGroupId: mine ? c.groupB : c.groupA,
              weeks: c.weeks,
              totalMinutes: c.totalMinutes,
            };
          }),
      };
    });
  const body = {
    studentId: DEFAULT_STUDENT_ID,
    allocation: Object.fromEntries(alloc),
    groups,
    // every option id is present (0 when nobody holds it)
    seats: Object.fromEntries([...catalog.options.keys()].map((id) => [id, seats.get(id) ?? 0])),
    clashes: clashes.map((c) => ({
      optionA: c.optionA,
      optionB: c.optionB,
      groupA: c.groupA,
      groupB: c.groupB,
      weeks: c.weeks,
      totalMinutes: c.totalMinutes,
      overlaps: c.overlaps.map((o) => ({
        day: o.day,
        fromMin: o.fromMin,
        toMin: o.toMin,
        minutes: o.minutes,
        weeks: o.weeks,
        partA: o.a.part,
        partB: o.b.part,
      })),
    })),
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
};
