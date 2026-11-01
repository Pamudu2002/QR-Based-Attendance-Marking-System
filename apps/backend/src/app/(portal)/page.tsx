import Link from "next/link";
import { Calendar, CircleCheck, Clock, Lightbulb, Plus, TriangleAlert } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Topbar } from "@/components/Topbar";
import { ico, icoXs } from "@/components/icon";
import { requireLecturer } from "@/lib/auth";
import { moduleDisplayName } from "@/lib/identity";
import { formatDay, formatLongDate, formatTime, zonedHour } from "@/lib/time";
import { listModules } from "@/server/modules";

export const metadata = { title: "Dashboard" };

function greeting(now: Date) {
  const h = zonedHour(now);
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function relative(startsAt: Date, now: Date) {
  const min = Math.round((startsAt.getTime() - now.getTime()) / 60_000);
  if (min <= 0) return "Now";
  if (min < 60) return `In ${min} min`;
  if (min < 24 * 60) return `In ${Math.round(min / 60)} h`;
  return formatDay(startsAt);
}

export default async function DashboardPage() {
  const lecturer = await requireLecturer();
  const modules = await listModules(lecturer.id);
  const now = new Date();

  const students = modules.reduce((n, m) => n + m.students, 0);
  const registered = modules.reduce((n, m) => n + m.registered, 0);
  const notRegistered = students - registered;
  const next = modules
    .filter((m) => m.nextSession)
    .sort((a, b) => a.nextSession!.startsAt.getTime() - b.nextSession!.startsAt.getTime())[0];

  return (
    <>
      <Topbar crumbs={[{ label: "Dashboard" }]} />
      <main className={`${s.main} ${s.mainLoose}`}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.h1Display}>
              {greeting(now)}, {lecturer.name}
            </h1>
            <p className={s.sub} style={{ marginTop: 4 }}>
              {formatLongDate(now)} · {modules.length} {modules.length === 1 ? "module" : "modules"}
            </p>
          </div>
          <div className={s.actions}>
            {modules.length === 0 ? (
              <Link className="lu-btn lu-btn--primary" href="/modules">
                <Plus {...ico} />
                Create your first module
              </Link>
            ) : (
              <Link className="lu-btn lu-btn--primary" href="/sessions">
                <Calendar {...ico} />
                Add session
              </Link>
            )}
          </div>
        </div>

        <section aria-label="Messages" className={s.noticeGrid}>
          {modules.length > 0 && students === 0 && (
            <div className="lu-notice lu-notice--info" role="status">
              <CircleCheck {...ico} />
              <span>
                <b>Add your students next.</b> Open a module and add them one at a time or import a CSV.
              </span>
            </div>
          )}
          {notRegistered > 0 && (
            <div className="lu-notice lu-notice--warning" role="status">
              <TriangleAlert {...ico} />
              <span>
                <b>
                  {notRegistered} {notRegistered === 1 ? "student hasn't" : "students haven't"} registered.
                </b>{" "}
                They can&apos;t check in until they scan the registration QR.
              </span>
            </div>
          )}
          <div className="lu-notice lu-notice--tip" role="note">
            <Lightbulb {...ico} />
            <span>
              <b>Tip:</b> the check-in code changes every 10 s, so a screenshot sent to a friend stops working.
            </span>
          </div>
        </section>

        <div className={s.split} style={{ alignItems: "stretch" }}>
          <section className={`${s.card} ${s.cardPadLg}`} style={{ flex: "1 1 340px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className={s.h2}>Next class</h2>
              {next?.nextSession && (
                <span className="lu-badge lu-badge--brand">
                  <Clock {...icoXs} />
                  {relative(next.nextSession.startsAt, now)}
                </span>
              )}
            </div>
            {next?.nextSession ? (
              <>
                <div>
                  <div className={s.muted}>{moduleDisplayName(next)}</div>
                  <div className={s.h1} style={{ marginTop: 2 }}>
                    {next.nextSession.title}
                  </div>
                </div>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px" }}>
                  <dt className={s.muted}>Time</dt>
                  <dd style={{ margin: 0 }}>
                    {formatDay(next.nextSession.startsAt)} · {formatTime(next.nextSession.startsAt)} –{" "}
                    {formatTime(next.nextSession.endsAt)}
                  </dd>
                  <dt className={s.muted}>Venue</dt>
                  <dd style={{ margin: 0 }}>{next.nextSession.venue}</dd>
                </dl>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className={s.strong}>Registered</span>
                    <span className={s.muted}>
                      {next.registered} of {next.students}
                    </span>
                  </div>
                  <span className={s.bar}>
                    <span style={{ width: `${next.students ? Math.round((next.registered / next.students) * 100) : 0}%` }} />
                  </span>
                </div>
                <div className={s.actions} style={{ marginTop: "auto" }}>
                  <Link className="lu-btn" href={`/modules/${next.id}/registration`}>
                    Registration
                  </Link>
                  <Link className="lu-btn lu-btn--ghost" href={`/modules/${next.id}/sessions`}>
                    Edit session
                  </Link>
                </div>
              </>
            ) : (
              <p className={s.muted} style={{ margin: 0 }}>
                No upcoming sessions. Add your classes on the Sessions page.
              </p>
            )}
          </section>

          <section aria-label="Key numbers" className={s.tiles} style={{ flex: "2 1 520px" }}>
            <div className={`${s.card} ${s.tile}`}>
              <span className={s.statLabel}>Registered on the app</span>
              <span className={s.statValue}>
                {registered} <small>of {students} students</small>
              </span>
              <span className={s.bar} style={{ marginTop: 6 }}>
                <span style={{ width: `${students ? Math.round((registered / students) * 100) : 0}%` }} />
              </span>
            </div>
            <div className={`${s.card} ${s.tile}`}>
              <span className={s.statLabel}>Modules</span>
              <span className={s.statValue}>{modules.length}</span>
              <span className={s.muted}>
                {modules.filter((m) => m.registrationOpen).length} with registration open
              </span>
            </div>
          </section>
        </div>

        <section className={`${s.card} ${s.cardPadLg}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className={s.h2}>Registration by module</h2>
            <Link className={s.link} href="/modules">
              View all
            </Link>
          </div>
          {modules.length === 0 && <p className={s.muted} style={{ margin: 0 }}>No modules yet.</p>}
          {modules.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Link href={`/modules/${m.id}`} className={s.moduleTitle} style={{ fontSize: 13 }}>
                  {m.code} {m.name}
                </Link>
                <span className={`${s.muted} ${s.nowrap}`}>
                  {m.registered} of {m.students}
                </span>
              </div>
              <span className={s.bar}>
                <span style={{ width: `${m.students ? Math.round((m.registered / m.students) * 100) : 0}%` }} />
              </span>
            </div>
          ))}
          <p className={s.muted} style={{ margin: 0, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            Students who haven&apos;t registered can&apos;t check in. Show the registration QR at the start of class.
          </p>
        </section>
      </main>
    </>
  );
}
