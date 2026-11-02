"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { icoXs } from "@/components/icon";
import { api } from "@/lib/client-api";
import { formatDayTime } from "@/lib/time";

type Live = {
  open: boolean;
  total: number;
  registered: number;
  latest: { indexNumber: string; name: string; at: string }[];
};

/** Registered count and the latest registrations, refreshed every 3 s. */
export function LiveRegistrations({ moduleId, initial }: { moduleId: string; initial: Live }) {
  const [live, setLive] = useState(initial);

  useEffect(() => {
    const id = setInterval(() => {
      api<Live>(`/modules/${moduleId}/registration/live`).then(setLive, () => {});
    }, 3000);
    return () => clearInterval(id);
  }, [moduleId]);

  const pct = live.total ? Math.round((live.registered / live.total) * 100) : 0;
  return (
    <>
      <div className={s.statValue} style={{ fontSize: 28, lineHeight: "34px" }} aria-live="polite">
        {live.registered} <small>of {live.total} students</small>
      </div>
      <span className={s.bar}>
        <span style={{ width: `${pct}%` }} />
      </span>
      <div className={s.statLabel} style={{ marginTop: 4 }}>
        Latest registrations
      </div>
      {live.latest.length === 0 ? (
        <span className={s.muted}>No one has registered yet.</span>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <tbody>
              {live.latest.map((r) => (
                <tr key={r.indexNumber}>
                  <td className={s.mono}>{r.indexNumber}</td>
                  <td className={s.strong}>{r.name}</td>
                  <td>
                    <span className="lu-badge lu-badge--success">
                      <Check {...icoXs} />
                      Registered
                    </span>
                  </td>
                  <td className={`${s.right} ${s.muted}`}>{formatDayTime(new Date(r.at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
