import Link from "next/link";
import { Download, Info } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Topbar } from "@/components/Topbar";
import { ico } from "@/components/icon";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { moduleShortName } from "@/lib/identity";
import { formatDay, formatTime } from "@/lib/time";

export const metadata = { title: "Experiment" };

const MODE = { NORMAL: "Class", EXP_GENUINE: "Genuine", EXP_RELAY: "Relay" } as const;

/** Experiment controls (PLAN §4.1, §9): experiment sessions, their runs, and the attempts export. */
export default async function ExperimentPage() {
  const lecturer = await requireLecturer();
  const sessions = await db.session.findMany({
    where: { isExperiment: true, module: { lecturerId: lecturer.id } },
    orderBy: { startsAt: "desc" },
    include: {
      module: { select: { intake: true, semester: true, code: true } },
      windows: { orderBy: { startedAt: "desc" }, select: { id: true, intervalSec: true, mode: true, label: true, enforceWifi: true, startedAt: true, endedAt: true } },
    },
  });
  const windowIds = sessions.flatMap((se) => se.windows.map((w) => w.id));
  const counts = windowIds.length
    ? await db.attempt.groupBy({ by: ["windowId", "verdict"], where: { windowId: { in: windowIds } }, _count: { _all: true } })
    : [];
  const countFor = (id: string) => {
    const rows = counts.filter((c) => c.windowId === id);
    return {
      total: rows.reduce((n, r) => n + r._count._all, 0),
      ok: rows.find((r) => r.verdict === "OK")?._count._all ?? 0,
      expired: rows.find((r) => r.verdict === "EXPIRED")?._count._all ?? 0,
    };
  };
  const unlinked = await db.attempt.count({
    where: { windowId: null, student: { roster: { some: { module: { lecturerId: lecturer.id } } } } },
  });

  return (
    <>
      <Topbar crumbs={[{ label: "Experiment" }]} />
      <main className={s.main}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.h1}>Experiment</h1>
            <p className={s.sub}>Runs with a fixed refresh interval T, and the per-attempt data for the analysis.</p>
          </div>
          <a className="lu-btn lu-btn--primary" href="/api/v1/experiment/attempts.csv" download>
            <Download {...ico} />
            Export attempts CSV
          </a>
        </div>

        <div className="lu-notice lu-notice--info" style={{ maxWidth: "none" }}>
          <Info {...ico} />
          <span>
            Add a session with <b>Experiment session</b> ticked (Sessions → Check-in rules), then open it and start a run with T = 5, 10 or 20 s. Genuine runs
            check the Wi-Fi name; relay runs don&apos;t, so the interval alone decides. The export has no names or index numbers: phones and students
            are pseudonymised.
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className={`${s.card} ${s.empty}`}>
            <span className={s.strong} style={{ color: "var(--ink)" }}>
              No experiment sessions yet
            </span>
            <Link className="lu-btn" href="/sessions">
              Add a session
            </Link>
          </div>
        ) : (
          sessions.map((se) => (
            <section key={se.id} className={`${s.card} ${s.cardFlush}`}>
              <div className={s.cardHead}>
                <span style={{ display: "flex", flexDirection: "column", marginLeft: 4 }}>
                  <span className={s.h2}>
                    {moduleShortName(se.module)} · {se.title}
                  </span>
                  <span className={`${s.small} ${s.muted}`}>
                    {formatDay(se.startsAt)} {formatTime(se.startsAt)}–{formatTime(se.endsAt)} · {se.venue}
                    {se.expectedSsid ? ` · Wi-Fi ${se.expectedSsid}` : " · no Wi-Fi name set"}
                  </span>
                </span>
                <Link className="lu-btn lu-btn--sm" href={`/sessions/${se.id}`}>
                  Open session and start a run
                </Link>
              </div>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Started</th>
                      <th>T</th>
                      <th>Run type</th>
                      <th>Label</th>
                      <th>Wi-Fi</th>
                      <th className={s.right}>Attempts</th>
                      <th className={s.right}>Accepted</th>
                      <th className={s.right}>Expired</th>
                    </tr>
                  </thead>
                  <tbody>
                    {se.windows.length === 0 && (
                      <tr>
                        <td colSpan={8} className={s.muted} style={{ textAlign: "center" }}>
                          No runs yet.
                        </td>
                      </tr>
                    )}
                    {se.windows.map((w) => {
                      const c = countFor(w.id);
                      return (
                        <tr key={w.id}>
                          <td className={s.nowrap}>
                            {formatTime(w.startedAt)}–{w.endedAt ? formatTime(w.endedAt) : <span className="lu-badge lu-badge--success">Open</span>}
                          </td>
                          <td className={s.mono}>{w.intervalSec} s</td>
                          <td>{MODE[w.mode]}</td>
                          <td className={s.muted}>{w.label ?? "–"}</td>
                          <td className={s.muted}>{w.enforceWifi ? "Checked" : "Logged only"}</td>
                          <td className={s.right}>{c.total}</td>
                          <td className={s.right}>{c.ok}</td>
                          <td className={s.right}>{c.expired}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
        {unlinked > 0 && (
          <p className={s.muted} style={{ margin: 0 }}>
            Plus {unlinked} {unlinked === 1 ? "attempt" : "attempts"} with no decoded code (no decode or cancelled), included in the export.
          </p>
        )}
      </main>
    </>
  );
}
