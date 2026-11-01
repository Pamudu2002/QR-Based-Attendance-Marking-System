import { Check, Clock, X } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { icoXs } from "@/components/icon";

/** Two-panel layout from design/screens/PortalLogin.dc.html. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.auth}>
      <section className={s.authHero}>
        <span aria-hidden className={s.authSun} />
        <Brand large />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
          <h1 className={s.authHeadline}>Attendance in one scan</h1>
          <p className={s.authLead}>
            Add your modules and students, show one QR on the projector, and see who was there, who was late and who
            is below 80%.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
          <div className={s.paper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sample-qr.svg" alt="Example check-in QR code" width={150} height={150} style={{ display: "block" }} />
            <div className={s.paperBar}>
              <div />
            </div>
            <span style={{ fontSize: 11, lineHeight: "16px", color: "#545f61" }}>New code in 6 s</span>
          </div>
          <ul className={s.legendList}>
            <li>
              <span className="lu-badge lu-badge--success">
                <Check {...icoXs} />
                Present
              </span>
              Checked in on time
            </li>
            <li>
              <span className="lu-badge lu-badge--warning">
                <Clock {...icoXs} />
                Late
              </span>
              Checked in after the late time
            </li>
            <li>
              <span className="lu-badge lu-badge--danger">
                <X {...icoXs} />
                Rejected
              </span>
              Old or forwarded code
            </li>
          </ul>
        </div>
      </section>

      <section className={s.authPanel}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ThemeToggle />
        </div>
        {children}
        <p className={`${s.small} ${s.muted}`} style={{ margin: 0, textAlign: "center" }}>
          Department of Computer Science &amp; Engineering
        </p>
      </section>
    </div>
  );
}
