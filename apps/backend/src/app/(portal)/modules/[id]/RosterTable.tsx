"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, CircleMinus, Ellipsis, Pencil, Trash, TriangleAlert } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ico, icoXs } from "@/components/icon";
import { androidVersion } from "@/lib/android";
import { api } from "@/lib/client-api";
import { nameKey } from "@/lib/identity";
import { formatDayTime } from "@/lib/time";

export type RosterTableRow = {
  studentId: string;
  indexNumber: string;
  name: string;
  registeredAt: Date | null;
  device: { model: string; manufacturer: string; androidSdk: number; status: string } | null;
  attendancePct: number | null;
};

type Filter = "all" | "registered" | "not_registered" | "below80";
const PAGE = 25;

export function RosterTable({ moduleId, rows }: { moduleId: string; rows: RosterTableRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      registered: rows.filter((r) => r.registeredAt).length,
      not_registered: rows.filter((r) => !r.registeredAt).length,
      below80: rows.filter((r) => r.attendancePct !== null && r.attendancePct < 80).length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toUpperCase();
    const qName = nameKey(query);
    return rows.filter((r) => {
      if (filter === "registered" && !r.registeredAt) return false;
      if (filter === "not_registered" && r.registeredAt) return false;
      if (filter === "below80" && !(r.attendancePct !== null && r.attendancePct < 80)) return false;
      if (!q) return true;
      return r.indexNumber.includes(q) || (qName.length > 0 && nameKey(r.name).includes(qName));
    });
  }, [rows, filter, query]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const pageRows = shown.slice(current * PAGE, current * PAGE + PAGE);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    setMenu(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function remove(r: RosterTableRow) {
    if (!confirm(`Remove ${r.indexNumber} ${r.name} from this module? Their attendance for this module stays in the records.`)) return;
    void run(r.studentId, () => api(`/modules/${moduleId}/students/${r.studentId}`, { method: "DELETE" }));
  }

  function reset(r: RosterTableRow) {
    if (!confirm(`Reset ${r.indexNumber}'s phone? Use this when they change phones. They'll need to scan the registration QR again with the new phone.`)) return;
    void run(r.studentId, () => api(`/students/${r.studentId}/reset-device`, { method: "POST" }));
  }

  function saveName() {
    if (!editing) return;
    const { id, name } = editing;
    void run(id, async () => {
      await api(`/modules/${moduleId}/students/${id}`, { method: "PATCH", body: { name } });
      setEditing(null);
    });
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `All ${counts.all}` },
    { key: "registered", label: `Registered ${counts.registered}` },
    { key: "not_registered", label: `Not registered ${counts.not_registered}` },
    { key: "below80", label: `Below 80% ${counts.below80}` },
  ];

  return (
    <section className={`${s.card} ${s.cardFlush}`}>
      <div className={s.cardHead}>
        <div role="group" aria-label="Filter students" className={s.segmented}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`lu-toggle ${filter === f.key ? "is-on" : ""}`}
              aria-pressed={filter === f.key}
              style={{ padding: "0 10px" }}
              onClick={() => {
                setFilter(f.key);
                setPage(0);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="lu-input"
          type="search"
          aria-label="Search students"
          placeholder="Search index or name"
          style={{ width: 200 }}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </div>
      {error && (
        <div className="lu-notice lu-notice--danger" role="alert" style={{ maxWidth: "none", margin: 12 }}>
          <TriangleAlert {...ico} />
          <span>{error}</span>
        </div>
      )}
      <div className={s.tableWrap}>
        <table className={s.table} style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Index no.</th>
              <th>Name on your list</th>
              <th>Status</th>
              <th>Phone</th>
              <th>Attendance</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className={s.muted} style={{ textAlign: "center", padding: 24 }}>
                  {rows.length === 0 ? "No students yet. Add them one at a time or import a CSV." : "No students match."}
                </td>
              </tr>
            )}
            {pageRows.map((r) => (
              <tr key={r.studentId} style={{ opacity: busy === r.studentId ? 0.5 : 1 }}>
                <td className={s.mono}>{r.indexNumber}</td>
                <td className={s.strong}>
                  {editing?.id === r.studentId ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <input
                        className="lu-input"
                        aria-label={`New name for ${r.indexNumber}`}
                        value={editing.name}
                        autoFocus
                        onChange={(e) => setEditing({ id: r.studentId, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        style={{ height: 28, minWidth: 160 }}
                      />
                      <button type="button" className="lu-btn lu-btn--sm" onClick={saveName}>
                        Save
                      </button>
                      <button type="button" className="lu-btn lu-btn--sm lu-btn--ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    r.name
                  )}
                </td>
                <td>
                  {r.registeredAt ? (
                    <span className={s.cellStack}>
                      <span className="lu-badge lu-badge--success">
                        <Check {...icoXs} />
                        Registered
                      </span>
                      <span className={`${s.small} ${s.muted}`}>on {formatDayTime(new Date(r.registeredAt))}</span>
                    </span>
                  ) : (
                    <span className="lu-badge">
                      <CircleMinus {...icoXs} />
                      Not registered
                    </span>
                  )}
                </td>
                <td className={s.muted}>
                  {r.device ? `${r.device.model} · ${androidVersion(r.device.androidSdk)}` : "–"}
                </td>
                <td>
                  {r.attendancePct === null ? (
                    <span className={s.muted}>No sessions yet</span>
                  ) : r.attendancePct >= 80 ? (
                    <span className={s.strong}>{r.attendancePct}%</span>
                  ) : (
                    <span className="lu-badge lu-badge--warning">
                      <TriangleAlert {...icoXs} />
                      {r.attendancePct}% · below 80%
                    </span>
                  )}
                </td>
                <td className={`${s.right} ${s.nowrap}`} style={{ position: "relative" }}>
                  {r.registeredAt && (
                    <button type="button" className="lu-btn lu-btn--sm lu-btn--ghost" onClick={() => reset(r)} disabled={!!busy}>
                      Reset device
                    </button>
                  )}
                  <button
                    type="button"
                    className="lu-iconbtn lu-iconbtn--sm"
                    aria-label={`More actions for ${r.indexNumber}`}
                    aria-expanded={menu === r.studentId}
                    style={{ verticalAlign: "middle" }}
                    onClick={() => setMenu(menu === r.studentId ? null : r.studentId)}
                  >
                    <Ellipsis {...ico} />
                  </button>
                  {menu === r.studentId && (
                    <div
                      role="menu"
                      style={{
                        position: "absolute",
                        right: 16,
                        top: "100%",
                        zIndex: 10,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-popover)",
                        padding: 4,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 180,
                        textAlign: "left",
                      }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="lu-btn lu-btn--ghost lu-btn--sm"
                        onClick={() => {
                          setMenu(null);
                          setEditing({ id: r.studentId, name: r.name });
                        }}
                      >
                        <Pencil {...ico} />
                        Edit name
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="lu-btn lu-btn--ghost lu-btn--sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => remove(r)}
                      >
                        <Trash {...ico} />
                        Remove from module
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.cardFoot}>
        <span>
          {shown.length === 0
            ? "Showing 0"
            : `Showing ${current * PAGE + 1}–${Math.min(shown.length, (current + 1) * PAGE)} of ${shown.length}`}
        </span>
        <span className={s.actions}>
          <button type="button" className="lu-btn lu-btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <button type="button" className="lu-btn lu-btn--sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </button>
        </span>
      </div>
    </section>
  );
}
