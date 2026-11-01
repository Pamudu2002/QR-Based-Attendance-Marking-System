import s from "@/app/styles/portal.module.css";
import { Sidebar } from "@/components/Sidebar";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { utcToZoned, zonedToUtc, addDays } from "@/lib/time";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const lecturer = await requireLecturer();
  const now = new Date();
  const todayStr = utcToZoned(now).date;
  const endOfToday = zonedToUtc(addDays(todayStr, 1), "00:00");

  const [moduleCount, today] = await Promise.all([
    db.module.count({ where: { lecturerId: lecturer.id, archivedAt: null } }),
    db.session.findFirst({
      where: { module: { lecturerId: lecturer.id, archivedAt: null }, endsAt: { gt: now }, startsAt: { lt: endOfToday } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        moduleId: true,
        title: true,
        startsAt: true,
        venue: true,
        module: { select: { intake: true, semester: true, code: true } },
      },
    }),
  ]);

  return (
    <div className={s.shell}>
      <Sidebar lecturer={lecturer} moduleCount={moduleCount} today={today} />
      <div className={s.column}>{children}</div>
    </div>
  );
}
