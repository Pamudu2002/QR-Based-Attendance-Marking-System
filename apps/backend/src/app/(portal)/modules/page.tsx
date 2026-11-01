import Link from "next/link";
import { Calendar, Check, Lock } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Topbar } from "@/components/Topbar";
import { ico, icoXs } from "@/components/icon";
import { requireLecturer } from "@/lib/auth";
import { moduleShortName } from "@/lib/identity";
import { formatDay, formatTime } from "@/lib/time";
import { listModules } from "@/server/modules";
import { ModuleForm } from "./ModuleForm";

export const metadata = { title: "Modules" };

export default async function ModulesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const lecturer = await requireLecturer();
  const archived = (await searchParams).archived === "1";
  const modules = await listModules(lecturer.id, { archived });
  const students = modules.reduce((n, m) => n + m.students, 0);
  const registered = modules.reduce((n, m) => n + m.registered, 0);

  return (
    <>
      <Topbar crumbs={[{ label: "Modules" }]} />
      <main className={`${s.main} ${s.mainLoose}`}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.h1}>Modules</h1>
            <p className={s.sub}>
              {modules.length} {archived ? "archived" : "active"} {modules.length === 1 ? "module" : "modules"} ·{" "}
              {students} students · {registered} registered on the app
            </p>
          </div>
          <div role="group" aria-label="Show" className={s.pill}>
            <Link href="/modules" className={`lu-toggle ${archived ? "" : "is-on"}`} aria-current={!archived ? "page" : undefined}>
              Active
            </Link>
            <Link href="/modules?archived=1" className={`lu-toggle ${archived ? "is-on" : ""}`} aria-current={archived ? "page" : undefined}>
              Archived
            </Link>
          </div>
        </div>

        <div className={s.split}>
          <div className={s.cardGrid} style={{ flex: "999 1 560px", minWidth: 0 }}>
            {modules.length === 0 && (
              <div className={`${s.card} ${s.empty}`} style={{ gridColumn: "1 / -1" }}>
                <span className={s.strong} style={{ color: "var(--ink)" }}>
                  {archived ? "No archived modules" : "No modules yet"}
                </span>
                {!archived && <span>Create your first module with the form on the right.</span>}
              </div>
            )}
            {modules.map((m) => (
              <article key={m.id} className={`${s.card} ${s.moduleCard}`}>
                <div className={s.moduleCardTop}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="lu-badge" style={{ alignSelf: "flex-start" }}>
                      {m.intake} · {m.semester}
                    </span>
                    <span className={`${s.mono} ${s.muted}`}>{moduleShortName(m)}</span>
                  </span>
                  {m.registrationOpen ? (
                    <span className="lu-badge lu-badge--success">
                      <Check {...icoXs} />
                      Registration open
                    </span>
                  ) : (
                    <span className="lu-badge">
                      <Lock {...icoXs} />
                      Registration closed
                    </span>
                  )}
                </div>
                <Link href={`/modules/${m.id}`} className={s.moduleTitle}>
                  {m.name}
                </Link>
                <dl className={s.moduleNums}>
                  <div>
                    <dt>Students</dt>
                    <dd>{m.students}</dd>
                  </div>
                  <div>
                    <dt>Registered</dt>
                    <dd>
                      {m.registered} of {m.students}
                    </dd>
                  </div>
                  <div>
                    <dt>Avg. attendance</dt>
                    <dd className={s.muted} style={{ fontWeight: 400 }}>
                      No data yet
                    </dd>
                  </div>
                </dl>
                <span className={s.iconLine}>
                  <Calendar {...ico} />
                  {m.nextSession
                    ? `Next: ${formatDay(m.nextSession.startsAt)} · ${formatTime(m.nextSession.startsAt)} · ${m.nextSession.venue}`
                    : "No upcoming sessions"}
                </span>
                <div className={s.actions} style={{ marginTop: "auto" }}>
                  <Link className={`lu-btn ${s.full}`} href={`/modules/${m.id}`} style={{ flex: 1 }}>
                    Open module
                  </Link>
                  <Link className="lu-btn lu-btn--ghost" href={`/modules/${m.id}/registration`}>
                    Registration
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {!archived && (
            <section id="new-module" aria-labelledby="nm-title" className={`${s.card} ${s.cardPadLg}`} style={{ flex: "1 1 288px" }}>
              <div>
                <h2 id="nm-title" className={s.h2}>
                  New module
                </h2>
                <p className={s.sub}>Students see it the same way as on Moodle.</p>
              </div>
              <ModuleForm />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
