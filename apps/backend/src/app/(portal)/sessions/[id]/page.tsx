import Link from "next/link";
import { notFound } from "next/navigation";
import s from "@/app/styles/portal.module.css";
import { Topbar } from "@/components/Topbar";
import { requireLecturer } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { formatDay, formatTime } from "@/lib/time";
import { sessionAttendance } from "@/server/attendance";
import { AttendanceList } from "./AttendanceList";
import { CheckinPanel } from "./CheckinPanel";

export const metadata = { title: "Session" };

async function load(lecturerId: string, id: string) {
  try {
    return await sessionAttendance(lecturerId, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lecturer = await requireLecturer();
  const data = await load(lecturer.id, id);
  const { session, counts } = data;

  const now = Date.now();
  const opensAt = new Date(session.startsAt.getTime() - session.opensBeforeMin * 60_000);
  const lateAt = new Date(session.startsAt.getTime() + session.lateAfterMin * 60_000);
  const isOver = session.endsAt.getTime() < now;
  const timeNote =
    now < opensAt.getTime()
      ? `Students can check in from ${formatTime(opensAt)}, ${session.opensBeforeMin} minutes before the start. Check-ins before then are rejected.`
      : isOver
        ? "This session is over. Check-ins now are rejected, but you can still fix marks by hand."
        : `Check-ins after ${formatTime(lateAt)} are marked late.`;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Modules", href: "/modules" },
          { label: session.module.shortName, href: `/modules/${session.module.id}/sessions` },
          { label: session.title },
        ]}
      />
      <main className={s.main}>
        <div className={s.pageHead}>
          <div>
            <Link href={`/modules/${session.module.id}`} className={`${s.mono} ${s.muted}`} style={{ textDecoration: "none" }}>
              {session.module.displayName}
            </Link>
            <h1 className={s.h1} style={{ marginTop: 2 }}>
              {session.title}
              {session.isExperiment && (
                <span className="lu-badge lu-badge--brand" style={{ marginLeft: 8, verticalAlign: "middle" }}>
                  Experiment
                </span>
              )}
            </h1>
            <p className={s.sub}>
              {formatDay(session.startsAt)} · {formatTime(session.startsAt)} – {formatTime(session.endsAt)} · {session.venue} · late after{" "}
              {formatTime(lateAt)}
              {session.expectedSsid ? ` · Wi-Fi ${session.expectedSsid}` : ""}
            </p>
          </div>
          <Link className="lu-btn lu-btn--ghost" href={`/modules/${session.module.id}/sessions`}>
            All sessions
          </Link>
        </div>

        <section aria-label="Summary" className={`${s.card} ${s.stats}`}>
          <div className={s.stat}>
            <div className={s.statLabel}>Present</div>
            <div className={s.statValue}>{counts.PRESENT}</div>
          </div>
          <div className={s.stat}>
            <div className={s.statLabel}>Late</div>
            <div className={s.statValue}>{counts.LATE}</div>
          </div>
          <div className={s.stat}>
            <div className={s.statLabel}>Excused</div>
            <div className={s.statValue}>{counts.EXCUSED}</div>
          </div>
          <div className={s.stat}>
            <div className={s.statLabel}>Absent</div>
            <div className={s.statValue}>{counts.ABSENT}</div>
            <span className={`${s.small} ${s.muted}`}>of {data.rows.length} registered</span>
          </div>
        </section>

        <div className={s.split}>
          <div className={s.splitMain}>
            <AttendanceList
              sessionId={session.id}
              live={!!data.activeWindow}
              rows={data.rows.map((r) => ({ ...r, markedAt: r.markedAt?.toISOString() ?? null }))}
            />
            {data.notRegistered.length > 0 && (
              <section className={`${s.card} ${s.cardPad}`}>
                <h2 className={s.h2}>Not registered yet ({data.notRegistered.length})</h2>
                <p className={s.muted} style={{ margin: 0 }}>
                  These students are on your list but haven&apos;t registered on the app, so they can&apos;t check in. They
                  don&apos;t count in the absent number.
                </p>
                <p style={{ margin: 0 }}>
                  {data.notRegistered.map((r, i) => (
                    <span key={r.studentId}>
                      {i > 0 && ", "}
                      <span className={s.mono}>{r.indexNumber}</span> {r.name}
                    </span>
                  ))}
                </p>
              </section>
            )}
          </div>
          <div className={s.splitSide}>
            <CheckinPanel
              sessionId={session.id}
              active={data.activeWindow ? { ...data.activeWindow, startedAt: data.activeWindow.startedAt.toISOString() } : null}
              expectedSsid={session.expectedSsid}
              isExperiment={session.isExperiment}
              canStart={!isOver || session.isExperiment}
              timeNote={timeNote}
            />
            {data.windows.length > 0 && (
              <section className={`${s.card} ${s.cardFlush}`}>
                <h2 className={s.h2} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                  Check-in history
                </h2>
                {data.windows.map((w, i) => (
                  <div key={w.id} className={`${s.listRow} ${i === 0 ? s.listRowFirst : ""}`}>
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <span className={s.strong}>
                        {formatTime(w.startedAt)}–{w.endedAt ? formatTime(w.endedAt) : "now"} · T = {w.intervalSec} s
                      </span>
                      <span className={`${s.small} ${s.muted}`}>
                        {w.mode === "NORMAL" ? "Class" : w.mode === "EXP_RELAY" ? "Relay run" : "Genuine run"}
                        {w.label ? ` · ${w.label}` : ""} · {w._count.attempts} attempts
                      </span>
                    </span>
                    {!w.endedAt && <span className="lu-badge lu-badge--success">Open</span>}
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
