import { QrCode } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ico } from "@/components/icon";
import { rosterStats } from "@/server/roster";
import { loadModule } from "../load";
import { RegistrationPanel } from "../RegistrationPanel";

export const metadata = { title: "Registration" };

export default async function RegistrationTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lecturer, mod } = await loadModule(id);
  const stats = await rosterStats(lecturer.id, id);
  const pct = stats.total ? Math.round((stats.registered / stats.total) * 100) : 0;

  return (
    <div className={s.split}>
      <div className={s.splitMain}>
        <section className={`${s.card} ${s.cardPadLg}`}>
          <h2 className={s.h2}>Registered on the app</h2>
          <div className={s.statValue} style={{ fontSize: 28, lineHeight: "34px" }}>
            {stats.registered} <small>of {stats.total} students</small>
          </div>
          <span className={s.bar}>
            <span style={{ width: `${pct}%` }} />
          </span>
          <p className={s.muted} style={{ margin: 0 }}>
            Students scan the registration QR in class and type the same name and index number you entered. Students
            who haven&apos;t registered can&apos;t check in.
          </p>
          <div className={s.actions}>
            <button type="button" className="lu-btn" disabled title="The projector page isn't built yet">
              <QrCode {...ico} />
              Show registration QR
            </button>
            <span className={`${s.small} ${s.muted}`}>The projector page isn&apos;t available yet.</span>
          </div>
        </section>
      </div>
      <div className={s.splitSide}>
        <RegistrationPanel moduleId={id} open={mod.registrationOpen} failedToday={stats.failedToday} />
      </div>
    </div>
  );
}
