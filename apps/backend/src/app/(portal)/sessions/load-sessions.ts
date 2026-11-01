import "server-only";
import { db } from "@/lib/db";
import { moduleDisplayName } from "@/lib/identity";
import { addDays, formatMonth, utcToZoned, weekday, zonedToUtc } from "@/lib/time";
import { listSessions } from "@/server/sessions";
import type { SessionsViewProps } from "./SessionsView";

/** Data for the sessions calendar of one month (YYYY-MM), optionally for one module. */
export async function loadSessionsView(
  lecturerId: string,
  opts: { month?: string; moduleId?: string; fixedModule: boolean },
): Promise<SessionsViewProps> {
  const now = new Date();
  const today = utcToZoned(now).date;
  const month = opts.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : today.slice(0, 7);
  const first = `${month}-01`;

  // Weeks start on Sunday, as in the design.
  const gridStart = addDays(first, -weekday(first));
  const nextMonthFirst = addDays(first, 32).slice(0, 7) + "-01";
  const daysToEnd = Math.ceil((Date.parse(nextMonthFirst) - Date.parse(gridStart)) / 86_400_000 / 7) * 7;
  const weeks: string[][] = [];
  for (let w = 0; w < daysToEnd / 7; w++) {
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  }
  const gridEnd = addDays(gridStart, daysToEnd);

  const [modules, inGrid, upcoming] = await Promise.all([
    db.module.findMany({
      where: { lecturerId, archivedAt: null },
      orderBy: [{ intake: "desc" }, { semester: "desc" }, { code: "asc" }],
      select: { id: true, intake: true, semester: true, code: true, name: true },
    }),
    listSessions(lecturerId, {
      moduleId: opts.moduleId,
      from: zonedToUtc(gridStart, "00:00"),
      to: zonedToUtc(gridEnd, "00:00"),
    }),
    listSessions(lecturerId, { moduleId: opts.moduleId, from: now }).then((l) => l.slice(0, 6)),
  ]);

  const toItem = (x: (typeof inGrid)[number]) => ({
    id: x.id,
    moduleId: x.moduleId,
    code: x.module.code,
    title: x.title,
    startsAt: x.startsAt.toISOString(),
    endsAt: x.endsAt.toISOString(),
    venue: x.venue,
    opensBeforeMin: x.opensBeforeMin,
    lateAfterMin: x.lateAfterMin,
    expectedSsid: x.expectedSsid,
    isExperiment: x.isExperiment,
  });

  const [y, m] = month.split("-").map(Number);
  const prev = new Date(Date.UTC(y!, m! - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 7);

  return {
    modules: modules.map((mod) => ({ id: mod.id, code: mod.code, label: moduleDisplayName(mod) })),
    moduleId: opts.moduleId ?? null,
    fixedModule: opts.fixedModule,
    month,
    monthLabel: formatMonth(zonedToUtc(first, "12:00")),
    prevMonth: prev,
    nextMonth: next,
    thisMonth: today.slice(0, 7),
    today,
    weeks,
    sessions: inGrid.map(toItem),
    upcoming: upcoming.map(toItem),
  };
}
