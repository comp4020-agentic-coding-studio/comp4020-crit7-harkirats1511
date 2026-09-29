// The routes the invariants run against. When you add a page, add its route
// here, or the invariants stop covering it. Dynamic routes need a concrete example path.
// The Daybook redesign added /change/ and /swap/, and the Change a class states of /course/[id]/ (a class, a legal
// preview, a clashing pick that lands from a refused select) each render different markup, so each is covered.
export const ROUTES = [
  "/",
  "/?day=tue",
  "/readme/",
  "/timetable/",
  "/change/",
  "/swap/",
  "/swap/?group=comp3900-tuta",
  "/course/COMP4020/",
  "/course/COMP3900/?group=comp3900-tuta",
  "/course/COMP3900/?group=comp3900-tuta&day=wed&pick=comp3900-tuta-06",
  "/course/COMP3900/?pick=comp3900-tuta-04",
  "/course/COMP3900/?pick=comp3900-tuta-02",
  "/grid/",
  "/draft/",
  "/history/",
  "/auto-fix/",
  "/preferences/",
];
