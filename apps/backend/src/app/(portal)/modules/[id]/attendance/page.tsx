import Link from "next/link";
import { Download } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ico } from "@/components/icon";
import { formatDay } from "@/lib/time";
import { moduleAttendance } from "@/server/attendance";
import { loadModule } from "../load";

export const metadata = { title: "Attendance" };

const CELL: Record<string, { cls: string; label: string }> = {
  P: { cls: "lu-badge lu-badge--success", label: "Present" },
  L: { cls: "lu-badge lu-badge--warning", label: "Late" },
  A: { cls: "lu-badge lu-badge--danger", label: "Absent" },
  E: { cls: "lu-badge", label: "Excused" },
};

/** Module attendance (design/screens/PortalAttendance.dc.html). */
export default async function AttendanceTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lecturer } = await loadModule(id);
  const m = await moduleAttendance(lecturer.id, id);
  const maxBand = Math.max(1, ...m.bands.map((b) => b.count));
  const below = m.students.filter((st) => st.below80).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));

  return (
    <>
      <div className={s.pageHead}>
        <p className={s.muted} style={{ margin: 0 }}>
          {m.students.length} registered students · {m.sessions.length} {m.sessions.length === 1 ? "class" : "classes"} so far · {m.upcoming} to go.
          Experiment sessions aren&apos;t counted.
        </p>
        <a className="lu-btn lu-btn--primary" href={`/api/v1/modules/${id}/attendance.csv`} download>
          <Download {...ico} />
          Export CSV
        </a>
      </div>

      {m.sessions.length === 0 ? (
        <div className={`${s.card} ${s.empty}`}>
          <span className={s.strong} style={{ color: "var(--ink)" }}>
            No classes yet
          </span>
          <span>The student × class table and the 80% line show here after the first class.</span>
        </div>
      ) : (
        <>
          <section aria-label="Summary" className={`${s.card} ${s.stats}`}>
            <div className={s.stat}>
              <div className={s.statLabel}>Average attendance</div>
              <div className={s.statValue}>{m.summary.average ?? "–"}%</div>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>At or above 80%</div>
              <div className={s.statValue}>{m.summary.atOrAbove}</div>
              <span className={`${s.small} ${s.muted}`}>of {m.students.length} registered</span>
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Below 80%</div>
              <div className={s.statValue}>{m.summary.below}</div>
              {m.summary.cannotReach > 0 ? (
                <span className="lu-badge lu-badge--danger">{m.summary.cannotReach} can&apos;t reach 80% now</span>
              ) : (
                <span className="lu-badge">All can still reach 80%</span>
              )}
            </div>
            <div className={s.stat}>
              <div className={s.statLabel}>Late arrivals</div>
              <div className={s.statValue}>{m.summary.lateTotal}</div>
              <span className="lu-badge lu-badge--warning">
                across {m.sessions.length} {m.sessions.length === 1 ? "class" : "classes"}
              </span>
            </div>
          </section>

          <div className={s.split} style={{ alignItems: "stretch" }}>
            <section className={`${s.card} ${s.cardPadLg}`} style={{ flex: "999 1 420px" }}>
              <div>
                <h2 className={s.h2}>Students by attendance</h2>
                <p className={s.sub}>Number of students in each band. Bands below 80% are amber.</p>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 180, borderBottom: "1px solid var(--line)" }} role="img" aria-label={m.bands.map((b) => `${b.label}: ${b.count}`).join(", ")}>
                {m.bands.map((b, i) => (
                  <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <span className={s.small} style={{ fontWeight: 600 }}>
                      {b.count}
                    </span>
                    <div style={{ width: "100%", height: Math.max(4, Math.round((b.count / maxBand) * 140)), borderRadius: "4px 4px 0 0", background: i < 4 ? "var(--lumen)" : "var(--brand)" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                {m.bands.map((b) => (
                  <span key={b.label} className={`${s.small} ${s.muted}`} style={{ flex: 1, textAlign: "center" }}>
                    {b.label}
                  </span>
                ))}
              </div>
            </section>

            <section className={`${s.card} ${s.cardFlush}`} style={{ flex: "1 1 300px" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                <h2 className={s.h2}>Below 80%</h2>
                <p className={s.sub}>{m.upcoming} {m.upcoming === 1 ? "class" : "classes"} left</p>
              </div>
              {below.length === 0 && <div className={`${s.listRow} ${s.listRowFirst} ${s.muted}`}>Everyone is at 80% or more.</div>}
              {below.map((st, i) => (
                <div key={st.studentId} className={`${s.listRow} ${i === 0 ? s.listRowFirst : ""}`}>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span className={s.strong}>{st.name}</span>
                    <span className={`${s.small} ${s.muted}`}>
                      <span className={s.mono}>{st.indexNumber}</span> ·{" "}
                      {st.missesLeft < 0 ? "can't reach 80% any more" : st.missesLeft === 0 ? `needs all ${m.upcoming} remaining` : `can miss ${st.missesLeft} more`}
                    </span>
                  </span>
                  <span className={`lu-badge ${st.missesLeft < 0 ? "lu-badge--danger" : "lu-badge--warning"}`}>{st.pct}%</span>
                </div>
              ))}
            </section>
          </div>

          <section className={`${s.card} ${s.cardFlush}`}>
            <div className={s.cardHead}>
              <h2 className={s.h2} style={{ marginLeft: 4 }}>
                Student by class
              </h2>
              <div className={s.actions} style={{ gap: 6 }}>
                {Object.entries(CELL).map(([k, v]) => (
                  <span key={k} className={v.cls}>
                    {k} · {v.label}
                  </span>
                ))}
              </div>
            </div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Student</th>
                    {m.sessions.map((se) => (
                      <th key={se.id} style={{ textAlign: "center" }}>
                        <Link href={`/sessions/${se.id}`} title={`${se.title}, ${formatDay(se.startsAt)}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {se.title.replace(/^Lecture\s*/i, "L")}
                        </Link>
                      </th>
                    ))}
                    <th className={s.right}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {m.students.map((st) => (
                    <tr key={st.studentId}>
                      <td>
                        <span className={s.cellStack}>
                          <span className={s.strong}>{st.name}</span>
                          <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 11 }}>
                            {st.indexNumber}
                          </span>
                        </span>
                      </td>
                      {st.cells.map((c, i) => (
                        <td key={i} style={{ textAlign: "center" }}>
                          <span className={CELL[c]!.cls} title={CELL[c]!.label} style={{ minWidth: 20, justifyContent: "center" }}>
                            {c}
                          </span>
                        </td>
                      ))}
                      <td className={s.right}>
                        {st.below80 ? <span className="lu-badge lu-badge--danger">{st.pct}%</span> : <span className={s.strong}>{st.pct}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
