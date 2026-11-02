"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api } from "@/lib/client-api";
import { formatTime } from "@/lib/time";

type Window = { id: string; intervalSec: number; enforceWifi: boolean; mode: string; label: string | null; startedAt: string };
type Live = { checkedIn: number; registered: number; onTime: number; late: number; rejected: number; attempts: number; accepted: number };

const MODES = [
  { value: "EXP_GENUINE", label: "Genuine run" },
  { value: "EXP_RELAY", label: "Relay run (Wi-Fi not checked)" },
] as const;

/** Start check-in, or show the open window with live counts. */
export function CheckinPanel({
  sessionId,
  active,
  expectedSsid,
  isExperiment,
  canStart,
  timeNote,
}: {
  sessionId: string;
  active: Window | null;
  expectedSsid: string | null;
  isExperiment: boolean;
  canStart: boolean;
  timeNote: string;
}) {
  const router = useRouter();
  const [intervalSec, setIntervalSec] = useState(isExperiment ? 5 : 10);
  const [mode, setMode] = useState<string>(isExperiment ? "EXP_GENUINE" : "NORMAL");
  const [label, setLabel] = useState("");
  const [enforceWifi, setEnforceWifi] = useState(!!expectedSsid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const poll = () => api<Live>(`/windows/${active.id}/live`).then((l) => !stopped && setLive(l), () => {});
    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active]);

  async function start() {
    setBusy(true);
    setError(null);
    // Open the tab during the click, or popup blockers stop it; point it at the projector once the window exists.
    const tab = window.open("about:blank", "_blank");
    try {
      const res = await api<{ window: { id: string } }>(`/sessions/${sessionId}/windows`, {
        body: {
          intervalSec,
          mode,
          label: label || null,
          enforceWifi: mode === "EXP_RELAY" ? false : enforceWifi && !!expectedSsid,
        },
      });
      if (tab) {
        tab.opener = null;
        tab.location.href = `/present/checkin/${res.window.id}`;
      }
      router.refresh();
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : "Couldn't start check-in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    if (!active) return;
    setBusy(true);
    try {
      await api(`/windows/${active.id}/end`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't end check-in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (active) {
    return (
      <section className={`${s.card} ${s.cardPad}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h2 className={s.h2}>Check-in is open</h2>
          <span className="lu-badge lu-badge--success">Open</span>
        </div>
        <p className={s.muted} style={{ margin: 0 }}>
          Started {formatTime(new Date(active.startedAt))} · code changes every {active.intervalSec} s ·{" "}
          {active.enforceWifi ? `Wi-Fi ${expectedSsid} checked` : "Wi-Fi not checked"}
          {active.mode !== "NORMAL" && ` · ${active.mode === "EXP_RELAY" ? "relay run" : "genuine run"}`}
          {active.label && ` · ${active.label}`}
        </p>
        {live && (
          <div className={s.actions} aria-live="polite">
            <span className={s.strong}>
              {live.checkedIn} of {live.registered} checked in
            </span>
            <span className="lu-badge lu-badge--success">{live.onTime} on time</span>
            <span className="lu-badge lu-badge--warning">{live.late} late</span>
            <span className="lu-badge lu-badge--danger">{live.rejected} rejected</span>
            {active.mode !== "NORMAL" && <span className="lu-badge lu-badge--brand">{live.accepted} of {live.attempts} attempts accepted</span>}
          </div>
        )}
        <FormError message={error} />
        <div className={s.actions}>
          <a className="lu-btn lu-btn--primary" href={`/present/checkin/${active.id}`} target="_blank" rel="noopener">
            <QrCode {...ico} />
            Open projector view
          </a>
          <button type="button" className="lu-btn lu-btn--danger" onClick={end} disabled={busy}>
            End check-in
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${s.card} ${s.cardPad}`}>
      <h2 className={s.h2}>{isExperiment ? "Start an experiment run" : "Start check-in"}</h2>
      <p className={s.muted} style={{ margin: 0 }}>
        {timeNote}
      </p>
      <FormError message={error} />
      {isExperiment ? (
        <>
          <div className={s.grid2}>
            <Field label="Refresh interval T">
              <select className="lu-input" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))}>
                {[5, 10, 20].map((t) => (
                  <option key={t} value={t}>
                    {t} s
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Run type">
              <select className="lu-input" value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Label (optional)" hint="Shown in the export, e.g. T5 front run 1.">
            <input className="lu-input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </Field>
        </>
      ) : (
        <Field label="Code changes every" hint="10 s is the default for classes.">
          <select className="lu-input" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))}>
            {[5, 10, 15, 20, 30].map((t) => (
              <option key={t} value={t}>
                {t} s
              </option>
            ))}
          </select>
        </Field>
      )}
      {expectedSsid && mode !== "EXP_RELAY" && (
        <label className="lu-check">
          <input type="checkbox" checked={enforceWifi} onChange={(e) => setEnforceWifi(e.target.checked)} />
          Only accept phones on <span className={s.mono}>{expectedSsid}</span>
        </label>
      )}
      <button type="button" className={`lu-btn lu-btn--primary ${s.full}`} onClick={start} disabled={busy || !canStart}>
        <QrCode {...ico} />
        {busy ? "Starting…" : isExperiment ? "Start run and open projector" : "Start check-in and open projector"}
      </button>
    </section>
  );
}
