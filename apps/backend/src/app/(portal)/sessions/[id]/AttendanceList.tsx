"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, CircleMinus, Clock, X } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { icoXs } from "@/components/icon";
import { api } from "@/lib/client-api";
import { formatTime } from "@/lib/time";

type Mark = "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
type Row = {
  studentId: string;
  indexNumber: string;
  name: string;
  status: Mark;
  markedAt: string | null;
  source: "QR" | "MANUAL" | null;
  note: string | null;
};

export function StatusBadge({ status }: { status: Mark }) {
  if (status === "PRESENT") return <span className="lu-badge lu-badge--success"><Check {...icoXs} />Present</span>;
  if (status === "LATE") return <span className="lu-badge lu-badge--warning"><Clock {...icoXs} />Late</span>;
  if (status === "EXCUSED") return <span className="lu-badge"><CircleMinus {...icoXs} />Excused</span>;
  return <span className="lu-badge lu-badge--danger"><X {...icoXs} />Absent</span>;
}

/** Registered students and their mark for this session, with manual fixes. Refreshes while check-in is open. */
export function AttendanceList({ sessionId, rows, live }: { sessionId: string; rows: Row[]; live: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | Mark>("all");
  const [editing, setEditing] = useState<{ id: string; status: Mark; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live || editing) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [live, editing, router]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${sessionId}/attendance/${editing.id}`, { method: "PUT", body: { status: editing.status, note: editing.note } });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const counts = { all: rows.length, PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 };
  for (const r of rows) counts[r.status]++;
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const filters: { key: "all" | Mark; label: string }[] = [
    { key: "all", label: `All ${counts.all}` },
    { key: "PRESENT", label: `Present ${counts.PRESENT}` },
    { key: "LATE", label: `Late ${counts.LATE}` },
    { key: "EXCUSED", label: `Excused ${counts.EXCUSED}` },
    { key: "ABSENT", label: `Absent ${counts.ABSENT}` },
  ];

  return (
    <section className={`${s.card} ${s.cardFlush}`}>
      <div className={s.cardHead}>
        <h2 className={s.h2} style={{ marginLeft: 4 }}>
          Registered students
        </h2>
        <div role="group" aria-label="Filter" className={s.segmented}>
          {filters.map((f) => (
            <button key={f.key} type="button" className={`lu-toggle ${filter === f.key ? "is-on" : ""}`} aria-pressed={filter === f.key} style={{ padding: "0 10px" }} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className={s.fieldError} style={{ margin: 12 }}>
          {error}
        </p>
      )}
      <div className={s.tableWrap}>
        <table className={s.table} style={{ minWidth: 680 }}>
          <thead>
            <tr>
              <th>Index no.</th>
              <th>Name</th>
              <th>Status</th>
              <th>Time</th>
              <th>How</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className={s.muted} style={{ textAlign: "center", padding: 24 }}>
                  {rows.length === 0 ? "No students have registered for this module yet." : "No students here."}
                </td>
              </tr>
            )}
            {shown.map((r) =>
              editing?.id === r.studentId ? (
                <tr key={r.studentId}>
                  <td className={s.mono}>{r.indexNumber}</td>
                  <td className={s.strong}>{r.name}</td>
                  <td>
                    <select
                      className="lu-input"
                      aria-label={`New status for ${r.indexNumber}`}
                      value={editing.status}
                      onChange={(e) => setEditing({ ...editing, status: e.target.value as Mark })}
                      style={{ height: 28 }}
                    >
                      <option value="PRESENT">Present</option>
                      <option value="LATE">Late</option>
                      <option value="EXCUSED">Excused</option>
                      <option value="ABSENT">Absent</option>
                    </select>
                  </td>
                  <td colSpan={2}>
                    <input
                      className="lu-input"
                      aria-label="Reason"
                      placeholder="Reason, e.g. medical certificate"
                      value={editing.note}
                      onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && save()}
                      style={{ height: 28, width: "100%" }}
                      maxLength={200}
                      autoFocus
                    />
                  </td>
                  <td className={`${s.right} ${s.nowrap}`}>
                    <button type="button" className="lu-btn lu-btn--sm" onClick={save} disabled={busy || !editing.note.trim()}>
                      Save
                    </button>{" "}
                    <button type="button" className="lu-btn lu-btn--sm lu-btn--ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={r.studentId}>
                  <td className={s.mono}>{r.indexNumber}</td>
                  <td className={s.strong}>{r.name}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={s.muted}>{r.markedAt ? formatTime(new Date(r.markedAt)) : "–"}</td>
                  <td className={s.muted}>
                    {r.source === "QR" ? "QR scan" : r.source === "MANUAL" ? <span title={r.note ?? ""}>By you · {r.note}</span> : "–"}
                  </td>
                  <td className={s.right}>
                    <button
                      type="button"
                      className="lu-btn lu-btn--sm lu-btn--ghost"
                      onClick={() => setEditing({ id: r.studentId, status: r.status === "ABSENT" ? "EXCUSED" : r.status, note: "" })}
                    >
                      Change
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
