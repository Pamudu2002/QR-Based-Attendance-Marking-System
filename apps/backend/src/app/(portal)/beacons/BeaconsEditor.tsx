"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CircleCheck, Smartphone } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api } from "@/lib/client-api";
import { formatDayTime } from "@/lib/time";

type Phone = {
  id: string;
  model: string;
  manufacturer: string;
  androidSdk: number;
  createdAt: string;
  online: boolean;
  state: string | null;
  lastSeenAt: string | null;
};
type LinkCode = { qr: string; expiresAt: string };

const STATE: Record<string, { text: string; tone: "success" | "danger" }> = {
  broadcasting: { text: "Broadcasting", tone: "success" },
  waiting: { text: "Ready", tone: "success" },
  bluetooth_off: { text: "Bluetooth is off", tone: "danger" },
  no_permission: { text: "Needs the Nearby devices permission", tone: "danger" },
  cant_broadcast: { text: "This phone can't broadcast", tone: "danger" },
};

export function BeaconsEditor({ initial }: { initial: Phone[] }) {
  const [phones, setPhones] = useState(initial);
  const [link, setLink] = useState<LinkCode | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [linked, setLinked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live status; faster while a link code is on screen, to show the new phone at once.
  useEffect(() => {
    let stopped = false;
    const known = new Set(phones.map((p) => p.id));
    const poll = () =>
      api<{ phones: Phone[] }>("/beacons").then(
        (r) => {
          if (stopped) return;
          const added = r.phones.find((p) => !known.has(p.id));
          if (added && link) {
            setLinked(`${added.model} is linked. Leave CSE Attendance Beacon open on it before class.`);
            setLink(null);
          }
          setPhones(r.phones);
        },
        () => {},
      );
    const id = setInterval(poll, link ? 1500 : 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  // Draw the link QR and count down its two minutes.
  useEffect(() => {
    if (!link) {
      setSvg(null);
      return;
    }
    let stopped = false;
    void QRCode.toString(link.qr, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#000000", light: "#ffffff" } }).then((out) => {
      if (!stopped) setSvg(out);
    });
    const tick = () => {
      const ms = new Date(link.expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) setLink(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [link]);

  async function showCode() {
    setBusy("code");
    setError(null);
    setLinked(null);
    try {
      setLink(await api<LinkCode>("/beacons/link-code", { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make a link code. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Phone) {
    if (!confirm(`Remove ${p.model}? It stops broadcasting for your classes until you link it again.`)) return;
    setBusy(p.id);
    setError(null);
    try {
      await api(`/beacons/${p.id}`, { method: "DELETE" });
      setPhones((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove it. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.split}>
      <div className={s.splitMain}>
        <FormError message={error} />
        {linked && (
          <div className="lu-notice lu-notice--success" role="status" style={{ maxWidth: "none" }}>
            <CircleCheck {...ico} />
            <span>{linked}</span>
          </div>
        )}
        <section className={`${s.card} ${s.cardFlush}`} aria-labelledby="phones-title">
          <div className={s.cardHead}>
            <h2 id="phones-title" className={s.h2}>
              Linked phones
            </h2>
            <span className={s.muted}>{phones.length ? `${phones.length} linked` : "None yet"}</span>
          </div>
          {phones.length === 0 ? (
            <div className={s.empty}>
              <Smartphone {...ico} />
              No beacon phone yet. Until you link one, students can check in from anywhere they can see the code.
            </div>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Last seen</th>
                    <th>Linked</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {phones.map((p) => {
                    const st = p.online ? (STATE[p.state ?? ""] ?? { text: "Online", tone: "success" as const }) : null;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className={s.strong}>{p.model}</span>
                          <span className={s.muted}> · {p.manufacturer} · API {p.androidSdk}</span>
                        </td>
                        <td>{st ? <span className={`lu-badge lu-badge--${st.tone}`}>{st.text}</span> : <span className="lu-badge">App closed</span>}</td>
                        <td className={s.muted}>{p.lastSeenAt ? formatDayTime(new Date(p.lastSeenAt)) : "–"}</td>
                        <td className={s.muted}>{formatDayTime(new Date(p.createdAt))}</td>
                        <td style={{ textAlign: "right" }}>
                          <button type="button" className="lu-btn lu-btn--ghost lu-btn--sm" disabled={busy === p.id} onClick={() => remove(p)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className={s.splitSide}>
        <section className={`${s.card} ${s.cardPad}`} aria-labelledby="link-title">
          <h2 id="link-title" className={s.h2}>
            Link a phone
          </h2>
          {link && svg ? (
            <>
              <div
                role="img"
                aria-label="Beacon link code"
                style={{ background: "#ffffff", borderRadius: 8, padding: 8, alignSelf: "center", width: 220, height: 220 }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className={s.muted} style={{ margin: 0, textAlign: "center" }}>
                Scan with CSE Attendance Beacon · works once · <span className={s.mono}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span> left
              </p>
              <p className={s.muted} style={{ margin: 0 }}>
                Don&apos;t show this on the projector: anyone who scans it can broadcast your beacon.
              </p>
            </>
          ) : (
            <ol className={s.muted} style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Install CSE Attendance Beacon on an Android phone (Android 6.0 or newer).</li>
              <li>Open it and tap Scan the link code.</li>
              <li>Show the code here and scan it. It works once and expires after 2 minutes.</li>
            </ol>
          )}
          <button type="button" className={`lu-btn ${link ? "" : "lu-btn--primary"} ${s.full}`} onClick={showCode} disabled={busy === "code"}>
            {busy === "code" ? "Making a code…" : link ? "Show a new code" : "Show link code"}
          </button>
        </section>
      </div>
    </div>
  );
}
