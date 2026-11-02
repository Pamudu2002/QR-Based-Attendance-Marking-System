"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { ProjectorLayout } from "../../ProjectorLayout";
import { RotatingQr, type TokenResponse } from "../../RotatingQr";
import s from "../../present.module.css";

type Live = {
  endedAt: string | null;
  registered: number;
  checkedIn: number;
  onTime: number;
  late: number;
  rejected: number;
  attempts: number;
  accepted: number;
};

export function CheckinProjector(props: {
  windowId: string;
  sessionId: string;
  badge: string;
  lead: string;
  intervalSec: number;
  experiment: string | null;
  initiallyEnded: boolean;
}) {
  const router = useRouter();
  const [ended, setEnded] = useState(props.initiallyEnded);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const l = await api<Live>(`/windows/${props.windowId}/live`);
        if (!stopped) {
          setLive(l);
          if (l.endedAt) setEnded(true);
        }
      } catch {}
    }
    void poll();
    const id = setInterval(poll, 1500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [props.windowId]);

  const fetchToken = useCallback(() => api<TokenResponse>(`/windows/${props.windowId}/token`), [props.windowId]);
  const onTokenError = useCallback((err: unknown) => {
    if (err instanceof ClientApiError && err.code === "WINDOW_ENDED") setEnded(true);
  }, []);

  async function end() {
    setBusy(true);
    setError(null);
    try {
      await api(`/windows/${props.windowId}/end`, { method: "POST" });
      setEnded(true);
      router.push(`/sessions/${props.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't end check-in. Try again.");
      setBusy(false);
    }
  }

  const pct = live && live.registered ? Math.round((live.checkedIn / live.registered) * 100) : 0;

  return (
    <ProjectorLayout
      badge={props.badge}
      headline="Scan to check in"
      lead={props.lead}
      steps={["Open CSE Attendance and tap Scan", "Point your camera at this code", "Confirm with your fingerprint or PIN"]}
      counter={
        <>
          <div className={s.counterHead}>
            <span>Checked in</span>
            <span className={s.count}>
              {live?.checkedIn ?? "–"} <small>of {live?.registered ?? "–"}</small>
            </span>
          </div>
          <span className={s.bar}>
            <span style={{ width: `${Math.min(100, pct)}%` }} />
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="lu-badge lu-badge--success">{live?.onTime ?? 0} on time</span>
            <span className="lu-badge lu-badge--warning">{live?.late ?? 0} late</span>
            <span className="lu-badge lu-badge--danger">{live?.rejected ?? 0} rejected</span>
            {props.experiment && (
              <span className="lu-badge lu-badge--brand">
                {props.experiment} · {live?.accepted ?? 0} of {live?.attempts ?? 0} attempts accepted
              </span>
            )}
          </span>
          {error && (
            <span role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          )}
        </>
      }
      endButton={
        !ended && (
          <button type="button" className="lu-btn lu-btn--danger" onClick={end} disabled={busy}>
            End check-in
          </button>
        )
      }
      qr={
        ended ? (
          <div className={s.closed}>
            <span>Check-in has ended, so no code is shown.</span>
            <Link className="lu-btn lu-btn--primary" href={`/sessions/${props.sessionId}`}>
              Back to the session
            </Link>
          </div>
        ) : (
          <RotatingQr fetchToken={fetchToken} onError={onTokenError} qrAlt={`Check-in QR code that changes every ${props.intervalSec} seconds`} />
        )
      }
    />
  );
}
