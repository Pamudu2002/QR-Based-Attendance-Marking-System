"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import s from "./present.module.css";

export type TokenResponse = {
  payload: string;
  seq: number;
  issuedAt: string;
  nextAt: string;
  intervalSec: number;
  serverTime: string;
};

type Props = {
  /** Fetches the current token; throws to show an error. */
  fetchToken: () => Promise<TokenResponse>;
  /** Called when fetching fails with a known reason (e.g. registration closed). */
  onError?: (err: unknown) => void;
  qrAlt: string;
  paused?: boolean;
};

const POLL_MS = 500;

/**
 * Polls the token endpoint every 500 ms and redraws when `seq` changes.
 * Times use the server clock (offset measured on each poll), so the laptop's
 * clock doesn't matter.
 */
export function RotatingQr({ fetchToken, onError, qrAlt, paused = false }: Props) {
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [svg, setSvg] = useState<string>("");
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const fetchRef = useRef(fetchToken);
  const errorRef = useRef(onError);
  fetchRef.current = fetchToken;
  errorRef.current = onError;

  useEffect(() => {
    if (paused) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    // Per run of this effect: a run that is stopped mid-draw must not stop the next run from drawing.
    let drawnSeq: number | null = null;

    async function poll() {
      const sentAt = Date.now();
      try {
        const t = await fetchRef.current();
        const receivedAt = Date.now();
        if (stopped) return;
        // Server time at the moment the response arrived ≈ serverTime + half the round trip.
        setOffsetMs(Date.parse(t.serverTime) + (receivedAt - sentAt) / 2 - receivedAt);
        if (t.seq !== drawnSeq) {
          // Error correction M, a 4-module quiet zone, drawn as sharp black squares.
          const out = await QRCode.toString(t.payload, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#000000", light: "#ffffff" } });
          if (stopped) return;
          setSvg(out);
          drawnSeq = t.seq;
        }
        setToken(t);
      } catch (err) {
        errorRef.current?.(err);
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [paused]);

  // Smooth countdown between polls.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  if (!token) {
    return <div className={s.qr} aria-label="Loading the code" />;
  }

  const serverNow = now + offsetMs;
  const remainingMs = Math.max(0, Date.parse(token.nextAt) - serverNow);
  const fraction = Math.min(1, remainingMs / (token.intervalSec * 1000));
  const driftSec = -offsetMs / 1000;

  return (
    <>
      <div className={s.qr} role="img" aria-label={qrAlt} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className={s.qrMeta}>
        <div className={s.countdown}>
          <div style={{ width: `${fraction * 100}%` }} />
        </div>
        <div className={s.metaRow}>
          <span>New code in {Math.ceil(remainingMs / 1000)} s</span>
          <span className={s.seq}>#{String(token.seq).padStart(4, "0")}</span>
        </div>
        <div className={s.drift}>
          Server time used
          {Math.abs(driftSec) >= 0.5 ? ` · this laptop is ${Math.abs(driftSec).toFixed(1)} s ${driftSec > 0 ? "ahead" : "behind"}` : ""}
        </div>
      </div>
    </>
  );
}
