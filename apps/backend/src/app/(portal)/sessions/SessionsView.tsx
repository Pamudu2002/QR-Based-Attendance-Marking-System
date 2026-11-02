"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Ellipsis } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api, ClientApiError } from "@/lib/client-api";
import { nthTitle } from "@/lib/series";
import { addDays, formatDay, formatTime, utcToZoned, zonedToUtc } from "@/lib/time";

export type SessionItem = {
  id: string;
  moduleId: string;
  code: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  opensBeforeMin: number;
  lateAfterMin: number;
  isExperiment: boolean;
};

export type SessionsViewProps = {
  modules: { id: string; code: string; label: string }[];
  moduleId: string | null;
  fixedModule: boolean;
  month: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  thisMonth: string;
  today: string;
  weeks: string[][];
  sessions: SessionItem[];
  upcoming: SessionItem[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Module colours on the calendar (cycled). Always paired with the module code.
const PALETTE = [
  { bg: "var(--brand)", fg: "var(--on-brand)", border: "var(--brand)", swatch: "var(--brand)" },
  { bg: "var(--lumen-soft)", fg: "var(--lumen-ink)", border: "var(--lumen)", swatch: "var(--lumen)" },
  { bg: "var(--surface-sunken)", fg: "var(--ink)", border: "var(--line-strong)", swatch: "var(--line-strong)" },
  { bg: "var(--brand-soft)", fg: "var(--brand)", border: "var(--brand)", swatch: "var(--brand-soft)" },
  { bg: "var(--success-soft)", fg: "var(--success)", border: "var(--success)", swatch: "var(--success)" },
];

type FormState = {
  moduleId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  venue: string;
  repeat: boolean;
  weeks: number;
  opensBeforeMin: number;
  lateAfterMin: number;
  isExperiment: boolean;
};

function emptyForm(moduleId: string, today: string): FormState {
  return {
    moduleId,
    title: "",
    date: today,
    start: "10:15",
    end: "12:15",
    venue: "",
    repeat: false,
    weeks: 4,
    opensBeforeMin: 15,
    lateAfterMin: 15,
    isExperiment: false,
  };
}

function formFrom(x: SessionItem): FormState {
  const start = utcToZoned(new Date(x.startsAt));
  return {
    moduleId: x.moduleId,
    title: x.title,
    date: start.date,
    start: start.time,
    end: utcToZoned(new Date(x.endsAt)).time,
    venue: x.venue,
    repeat: false,
    weeks: 1,
    opensBeforeMin: x.opensBeforeMin,
    lateAfterMin: x.lateAfterMin,
    isExperiment: x.isExperiment,
  };
}

export function SessionsView(props: SessionsViewProps) {
  const router = useRouter();
  const path = usePathname();
  const { modules, today } = props;
  const defaultModule = props.moduleId ?? modules[0]?.id ?? "";

  const [editing, setEditing] = useState<SessionItem | null>(null);
  const [f, setF] = useState<FormState>(() => emptyForm(defaultModule, today));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const colour = useMemo(() => new Map(modules.map((m, i) => [m.id, PALETTE[i % PALETTE.length]!])), [modules]);
  const byDay = useMemo(() => {
    const map = new Map<string, SessionItem[]>();
    for (const x of props.sessions) {
      const d = utcToZoned(new Date(x.startsAt)).date;
      map.set(d, [...(map.get(d) ?? []), x]);
    }
    return map;
  }, [props.sessions]);

  const monthHref = (m: string) => {
    const q = new URLSearchParams();
    q.set("month", m);
    if (props.moduleId && !props.fixedModule) q.set("module", props.moduleId);
    return `${path}?${q}`;
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const count = !editing && f.repeat ? Math.max(1, Math.min(20, f.weeks || 1)) : 1;

  function startEdit(x: SessionItem) {
    setEditing(x);
    setF(formFrom(x));
    setError(null);
    setFieldErrors({});
    setNotice(null);
  }

  function cancelEdit() {
    setEditing(null);
    setF(emptyForm(defaultModule, today));
    setError(null);
    setFieldErrors({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setNotice(null);
    if (!f.moduleId) {
      setError("Create a module first.");
      return;
    }
    if (!f.date || !f.start || !f.end) {
      setError("Enter the date, start and end time.");
      return;
    }
    const body = {
      title: f.title,
      startsAt: zonedToUtc(f.date, f.start).toISOString(),
      endsAt: zonedToUtc(f.date, f.end).toISOString(),
      venue: f.venue,
      opensBeforeMin: Number(f.opensBeforeMin),
      lateAfterMin: Number(f.lateAfterMin),
      isExperiment: f.isExperiment,
    };
    setBusy(true);
    try {
      if (editing) {
        await api(`/sessions/${editing.id}`, { method: "PATCH", body });
        setNotice(`${f.title} saved.`);
        setEditing(null);
      } else {
        await api(`/modules/${f.moduleId}/sessions`, { body: { ...body, repeatWeeks: count } });
        setNotice(count === 1 ? `${f.title} added.` : `${count} sessions added, ${f.title} to ${nthTitle(f.title, count - 1)}.`);
      }
      setF(emptyForm(f.moduleId, today));
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && Object.keys(err.fieldErrors).length) setFieldErrors(err.fieldErrors);
      else setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm(`Delete ${editing.title} on ${formatDay(new Date(editing.startsAt))}? Its attendance records are deleted too.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${editing.id}`, { method: "DELETE" });
      setNotice(`${editing.title} deleted.`);
      cancelEdit();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const todayFirst = props.upcoming.find((x) => utcToZoned(new Date(x.startsAt)).date === today);
  const lastDate = addDays(f.date || today, (count - 1) * 7);

  return (
    <>
      {!props.fixedModule && (
        <div className={s.pageHead}>
          <div>
            <h1 className={s.h1}>Sessions</h1>
            <p className={s.sub}>Your real classes. Start check-in from a session during its time.</p>
          </div>
          <label className={s.actions} style={{ color: "var(--ink-muted)" }}>
            Module
            <select
              className="lu-input"
              value={props.moduleId ?? ""}
              onChange={(e) => {
                const q = new URLSearchParams({ month: props.month });
                if (e.target.value) q.set("module", e.target.value);
                router.push(`${path}?${q}`);
              }}
            >
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {todayFirst && (
        <div className="lu-notice lu-notice--info" role="status" style={{ maxWidth: "none" }}>
          <Info {...ico} />
          <span>
            Check-in for{" "}
            <b>
              {todayFirst.code} {todayFirst.title}
            </b>{" "}
            opens at {formatTime(new Date(new Date(todayFirst.startsAt).getTime() - todayFirst.opensBeforeMin * 60_000))},{" "}
            {todayFirst.opensBeforeMin} minutes before the class.
          </span>
          <Link className="lu-btn lu-btn--sm" href={`/sessions/${todayFirst.id}`}>
            Open session
          </Link>
        </div>
      )}

      <div className={s.split}>
        <section className={`${s.card} ${s.cardFlush}`} style={{ flex: "999 1 620px", minWidth: 0 }}>
          <div className={s.calHead}>
            <div className={s.calNav}>
              <Link className="lu-iconbtn" href={monthHref(props.prevMonth)} aria-label="Previous month" title="Previous month">
                <ChevronLeft {...ico} />
              </Link>
              <h2 className={s.h2} style={{ margin: "0 4px" }}>
                {props.monthLabel}
              </h2>
              <Link className="lu-iconbtn" href={monthHref(props.nextMonth)} aria-label="Next month" title="Next month">
                <ChevronRight {...ico} />
              </Link>
              {props.month !== props.thisMonth && (
                <Link className="lu-btn lu-btn--sm lu-btn--ghost" href={monthHref(props.thisMonth)}>
                  Today
                </Link>
              )}
            </div>
            {modules.length > 1 && !props.fixedModule && (
              <div className={s.legend}>
                {modules.map((m) => (
                  <span key={m.id}>
                    <span className={s.swatch} style={{ background: colour.get(m.id)!.swatch }} />
                    {m.code}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={s.tableWrap}>
            <div className={s.calGrid}>
              <div className={`${s.calRow} ${s.calWeekdays}`}>
                {WEEKDAYS.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              {props.weeks.map((week) => (
                <div key={week[0]} className={s.calRow}>
                  {week.map((d) => {
                    const inMonth = d.startsWith(props.month);
                    const isToday = d === today;
                    return (
                      <div
                        key={d}
                        className={`${s.calCell} ${!inMonth ? s.calCellOut : ""} ${isToday ? s.calCellToday : ""}`}
                      >
                        <span
                          className={`${s.calNum} ${!inMonth ? s.calNumOut : ""} ${isToday ? s.calNumToday : ""}`}
                        >
                          {Number(d.slice(8))}
                        </span>
                        {(byDay.get(d) ?? []).map((x) => {
                          const c = colour.get(x.moduleId) ?? PALETTE[0]!;
                          return (
                            <button
                              key={x.id}
                              type="button"
                              className={`${s.chip} ${editing?.id === x.id ? s.chipSelected : ""}`}
                              style={{ background: c.bg, color: c.fg, borderColor: c.border }}
                              title={`${x.code} ${x.title} · ${formatTime(new Date(x.startsAt))}–${formatTime(new Date(x.endsAt))} · ${x.venue}`}
                              onClick={() => startEdit(x)}
                            >
                              {formatTime(new Date(x.startsAt))} {props.fixedModule ? x.title : x.code}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className={s.splitSide}>
          <form aria-labelledby="add-title" className={`${s.card} ${s.cardPad}`} onSubmit={submit} noValidate>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h2 id="add-title" className={s.h2}>
                {editing ? "Edit session" : "Add session"}
              </h2>
              {editing && (
                <Link className="lu-btn lu-btn--sm" href={`/sessions/${editing.id}`}>
                  Open session
                </Link>
              )}
            </div>
            <FormError message={error} />
            {notice && (
              <div className="lu-notice lu-notice--success" role="status" style={{ maxWidth: "none" }}>
                <span>{notice}</span>
              </div>
            )}
            {!props.fixedModule && (
              <Field label="Module">
                <select className="lu-input" value={f.moduleId} disabled={!!editing} onChange={(e) => set("moduleId", e.target.value)}>
                  {modules.length === 0 && <option value="">Create a module first</option>}
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Title" error={fieldErrors.title?.[0]}>
              <input className="lu-input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Lecture 10" aria-invalid={!!fieldErrors.title} />
            </Field>
            <div className={s.grid3}>
              <Field label="Date">
                <input className="lu-input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Start">
                <input className="lu-input" type="time" value={f.start} onChange={(e) => set("start", e.target.value)} />
              </Field>
              <Field label="End" error={fieldErrors.endsAt?.[0]}>
                <input className="lu-input" type="time" value={f.end} onChange={(e) => set("end", e.target.value)} aria-invalid={!!fieldErrors.endsAt} />
              </Field>
            </div>
            <Field label="Venue" error={fieldErrors.venue?.[0]}>
              <input className="lu-input" value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Lecture Hall A" aria-invalid={!!fieldErrors.venue} />
            </Field>
            {!editing && (
              <div className={s.sunkenBox} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <label className="lu-check">
                  <input type="checkbox" checked={f.repeat} onChange={(e) => set("repeat", e.target.checked)} />
                  Repeat every week
                </label>
                <span className={s.actions} style={{ gap: 6 }}>
                  for
                  <input
                    className="lu-input"
                    type="number"
                    min={2}
                    max={20}
                    value={f.weeks}
                    disabled={!f.repeat}
                    onChange={(e) => set("weeks", Number(e.target.value))}
                    aria-label="Number of weeks"
                    style={{ width: 52, height: 28, textAlign: "center", padding: "0 4px" }}
                  />
                  weeks
                </span>
              </div>
            )}
            {count > 1 && (
              <span className={s.muted}>
                {f.title || "Session"} to {nthTitle(f.title || "Session", count - 1)}, last on {formatDay(zonedToUtc(lastDate, "12:00"))}.
              </span>
            )}
            <details className={s.muted}>
              <summary style={{ cursor: "pointer", color: "var(--ink)", fontWeight: 600 }}>Check-in rules</summary>
              <div className={s.form} style={{ marginTop: 8 }}>
                <p style={{ margin: 0 }}>
                  Opens {f.opensBeforeMin} min before the start · late after {f.lateAfterMin} min
                </p>
                <div className={s.grid2}>
                  <Field label="Opens before (min)">
                    <input className="lu-input" type="number" min={0} max={120} value={f.opensBeforeMin} onChange={(e) => set("opensBeforeMin", Number(e.target.value))} />
                  </Field>
                  <Field label="Late after (min)">
                    <input className="lu-input" type="number" min={0} max={240} value={f.lateAfterMin} onChange={(e) => set("lateAfterMin", Number(e.target.value))} />
                  </Field>
                </div>
                <label className="lu-check">
                  <input type="checkbox" checked={f.isExperiment} onChange={(e) => set("isExperiment", e.target.checked)} />
                  Experiment session (not counted in attendance %)
                </label>
              </div>
            </details>
            <button type="submit" className={`lu-btn lu-btn--primary ${s.full}`} disabled={busy || modules.length === 0}>
              {busy ? "Saving…" : editing ? "Save changes" : count === 1 ? "Save session" : `Save ${count} sessions`}
            </button>
            {editing && (
              <div className={s.actions} style={{ justifyContent: "space-between" }}>
                <button type="button" className="lu-btn lu-btn--ghost" onClick={cancelEdit} disabled={busy}>
                  Cancel
                </button>
                <button type="button" className="lu-btn lu-btn--danger" onClick={remove} disabled={busy}>
                  Delete session
                </button>
              </div>
            )}
          </form>

          <section className={`${s.card} ${s.cardFlush}`}>
            <h2 className={s.h2} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
              Coming up
            </h2>
            {props.upcoming.length === 0 && (
              <div className={`${s.listRow} ${s.listRowFirst} ${s.muted}`}>No upcoming sessions.</div>
            )}
            {props.upcoming.map((x, i) => {
              const isToday = utcToZoned(new Date(x.startsAt)).date === today;
              return (
                <div key={x.id} className={`${s.listRow} ${i === 0 ? s.listRowFirst : ""} ${isToday ? s.listRowHi : ""}`}>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span className={s.strong}>
                      {x.code} · {x.title}
                    </span>
                    <span className={`${s.small} ${s.muted}`}>
                      {isToday ? "Today" : formatDay(new Date(x.startsAt))} {formatTime(new Date(x.startsAt))} · {x.venue}
                    </span>
                  </span>
                  {isToday ? (
                    <Link className="lu-btn lu-btn--sm" href={`/sessions/${x.id}`}>
                      Open
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="lu-iconbtn lu-iconbtn--sm"
                      aria-label={`Edit ${x.code} ${x.title}`}
                      title="Edit"
                      onClick={() => startEdit(x)}
                    >
                      <Ellipsis {...ico} />
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}
