"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleX } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ico } from "@/components/icon";
import { api } from "@/lib/client-api";
import { formatTime } from "@/lib/time";
import { FAILED_REGISTRATION_TEXT } from "@/lib/verdicts";

type Failed = { id: string; indexNumberTyped: string; verdict: string; at: Date };

export function RegistrationPanel({
  moduleId,
  open,
  failedToday,
}: {
  moduleId: string;
  open: boolean;
  failedToday: Failed[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api(`/modules/${moduleId}/registration/${next ? "open" : "close"}`, { method: "POST" });
      setIsOpen(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change registration. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${s.card} ${s.cardPad}`} style={{ gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className={s.h2}>Registration</h2>
        <label className="lu-check">
          <input type="checkbox" checked={isOpen} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
          Open
        </label>
      </div>
      <p className={s.muted} style={{ margin: 0 }}>
        {isOpen
          ? "Students on your list can register by scanning the QR in class."
          : "Registration is closed. Open it before you show the registration QR."}
      </p>
      {error && (
        <p role="alert" className={s.fieldError} style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <div className={s.statLabel} style={{ marginTop: 4 }}>
        Failed attempts today
      </div>
      {failedToday.length === 0 ? (
        <span className={s.muted}>None so far.</span>
      ) : (
        failedToday.map((f) => (
          <div key={f.id} className="lu-notice lu-notice--danger" style={{ maxWidth: "none" }}>
            <CircleX {...ico} />
            <span>
              <b className={s.mono} style={{ fontWeight: 600 }}>
                {f.indexNumberTyped}
              </b>{" "}
              {FAILED_REGISTRATION_TEXT[f.verdict] ?? "couldn't register."} {formatTime(new Date(f.at))}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
