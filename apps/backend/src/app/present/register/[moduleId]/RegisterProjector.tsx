"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { ProjectorLayout } from "../../ProjectorLayout";
import { RotatingQr, type TokenResponse } from "../../RotatingQr";
import s from "../../present.module.css";

type Live = { open: boolean; total: number; registered: number };

export function RegisterProjector({
  moduleId,
  shortName,
  name,
  initialOpen,
}: {
  moduleId: string;
  shortName: string;
  name: string;
  initialOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [live, setLive] = useState<Live | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live counter every 2 s.
  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const l = await api<Live>(`/modules/${moduleId}/registration/live`);
        if (!stopped) {
          setLive(l);
          setOpen(l.open);
        }
      } catch {}
    }
    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [moduleId]);

  const fetchToken = useCallback(() => api<TokenResponse>(`/modules/${moduleId}/registration/token`), [moduleId]);
  const onTokenError = useCallback((err: unknown) => {
    if (err instanceof ClientApiError && err.code === "REGISTRATION_CLOSED") setOpen(false);
  }, []);

  async function setRegistration(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api(`/modules/${moduleId}/registration/${next ? "open" : "close"}`, { method: "POST" });
      setOpen(next);
      if (!next) router.push(`/modules/${moduleId}/registration`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change registration. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const pct = live && live.total ? Math.round((live.registered / live.total) * 100) : 0;

  return (
    <ProjectorLayout
      badge={`${shortName} · ${name}`}
      headline="Scan to register"
      lead="Do this once for this module. Then you can check in to every class."
      steps={["Open CSE Attendance and tap Scan", "Type your index number and name as on the class list", "Confirm with your fingerprint or PIN"]}
      counter={
        <>
          <div className={s.counterHead}>
            <span>Registered</span>
            <span className={s.count}>
              {live?.registered ?? "–"} <small>of {live?.total ?? "–"}</small>
            </span>
          </div>
          <span className={s.bar}>
            <span style={{ width: `${pct}%` }} />
          </span>
          <span style={{ color: "var(--ink-muted)" }}>Not on the list? Ask your lecturer to add you.</span>
          {error && (
            <span role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          )}
        </>
      }
      endButton={
        open && (
          <button type="button" className="lu-btn lu-btn--danger" onClick={() => setRegistration(false)} disabled={busy}>
            Close registration
          </button>
        )
      }
      qr={
        open ? (
          <RotatingQr fetchToken={fetchToken} onError={onTokenError} qrAlt="Registration QR code for this module" />
        ) : (
          <div className={s.closed}>
            <span>Registration is closed, so no code is shown.</span>
            <button type="button" className="lu-btn lu-btn--primary" onClick={() => setRegistration(true)} disabled={busy}>
              Open registration
            </button>
          </div>
        )
      }
    />
  );
}
