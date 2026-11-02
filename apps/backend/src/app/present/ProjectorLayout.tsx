"use client";

import { useEffect, useState } from "react";
import { Maximize, Moon, Sun } from "lucide-react";
import { ico } from "@/components/icon";
import s from "./present.module.css";

/** Shared layout of the projector pages (design/screens/Projector.dc.html). */
export function ProjectorLayout({
  badge,
  headline,
  lead,
  steps,
  counter,
  endButton,
  qr,
}: {
  badge: string;
  headline: string;
  lead: string;
  steps: [string, string, string];
  counter: React.ReactNode;
  endButton?: React.ReactNode;
  qr: React.ReactNode;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setDark(!dark);
  }

  return (
    <div className={s.root}>
      <section className={s.info}>
        <div className={s.top}>
          <span className={s.brand}>
            CSE <span>Attendance</span>
          </span>
          <span className={`lu-badge ${s.moduleBadge}`}>{badge}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 className={s.headline}>{headline}</h1>
          <p className={s.lead}>{lead}</p>
        </div>

        <ol className={s.steps}>
          {steps.map((step, i) => (
            <li key={i}>
              <span className={`${s.stepNum} ${i === 2 ? s.stepNumLast : ""}`}>{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <div className={s.bottom}>
          <div className={s.counter} aria-live="polite">
            {counter}
          </div>
          <div className={s.controls}>
            <button type="button" className="lu-btn" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
              <Maximize {...ico} />
              Full screen
            </button>
            <button type="button" className="lu-btn" onClick={toggleTheme}>
              {dark ? <Sun {...ico} /> : <Moon {...ico} />}
              Switch theme
            </button>
            {endButton}
          </div>
        </div>
      </section>

      <section aria-label="QR code" className={s.qrSide}>
        <div className={s.paper}>{qr}</div>
      </section>
    </div>
  );
}
