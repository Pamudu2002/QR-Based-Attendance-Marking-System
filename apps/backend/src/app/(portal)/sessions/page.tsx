import s from "@/app/styles/portal.module.css";
import { Topbar } from "@/components/Topbar";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadSessionsView } from "./load-sessions";
import { SessionsView } from "./SessionsView";

export const metadata = { title: "Sessions" };

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; module?: string }>;
}) {
  const lecturer = await requireLecturer();
  const q = await searchParams;
  // Ignore a module filter that isn't one of mine.
  const moduleId = q.module
    ? ((await db.module.findFirst({ where: { id: q.module, lecturerId: lecturer.id }, select: { id: true } }))?.id ?? undefined)
    : undefined;
  const props = await loadSessionsView(lecturer.id, { month: q.month, moduleId, fixedModule: false });

  return (
    <>
      <Topbar crumbs={[{ label: "Sessions" }]} />
      <main className={s.main}>
        <SessionsView {...props} />
      </main>
    </>
  );
}
