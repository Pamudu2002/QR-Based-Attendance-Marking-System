import { QrCode } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ico } from "@/components/icon";
import { registrationLive } from "@/server/registration";
import { loadModule } from "../load";
import { RegistrationPanel } from "../RegistrationPanel";
import { LiveRegistrations } from "./LiveRegistrations";

export const metadata = { title: "Registration" };

export default async function RegistrationTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lecturer, mod } = await loadModule(id);
  const live = await registrationLive(lecturer.id, id);

  return (
    <div className={s.split}>
      <div className={s.splitMain}>
        <section className={`${s.card} ${s.cardPadLg}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 className={s.h2}>Registered on the app</h2>
            <a className="lu-btn lu-btn--primary" href={`/present/register/${id}`} target="_blank" rel="noopener">
              <QrCode {...ico} />
              Show registration QR
            </a>
          </div>
          <LiveRegistrations
            moduleId={id}
            initial={{
              open: live.open,
              total: live.total,
              registered: live.registered,
              latest: live.latest.map((r) => ({ ...r, at: r.at!.toISOString() })),
            }}
          />
          <p className={s.muted} style={{ margin: 0 }}>
            Students scan the registration QR in class and type the same name and index number you entered. The code
            changes every {mod.regIntervalSec} s, so it only works in the room. Students who haven&apos;t registered
            can&apos;t check in.
          </p>
        </section>
      </div>
      <div className={s.splitSide}>
        <RegistrationPanel moduleId={id} open={mod.registrationOpen} failedToday={live.failed} />
      </div>
    </div>
  );
}
