import { Info } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Topbar } from "@/components/Topbar";
import { ico } from "@/components/icon";
import { requireLecturer } from "@/lib/auth";
import { listBeaconPhones } from "@/server/beacons";
import { BeaconsEditor } from "./BeaconsEditor";

export const metadata = { title: "Beacon phones" };

/** Phones running CSE Attendance Beacon, linked to this lecturer (PLAN §6.5). */
export default async function BeaconsPage() {
  const lecturer = await requireLecturer();
  const phones = await listBeaconPhones(lecturer.id);

  return (
    <>
      <Topbar crumbs={[{ label: "Beacon phones" }]} />
      <main className={s.main}>
        <div className={s.pageHead}>
          <div>
            <h1 className={s.h1}>Beacon phones</h1>
            <p className={s.sub}>An Android phone on your desk that proves students are in the room.</p>
          </div>
        </div>

        <div className="lu-notice lu-notice--info" style={{ maxWidth: "none" }}>
          <Info {...ico} />
          <span>
            Open <b>CSE Attendance Beacon</b> on the phone before class and leave it on the desk with Bluetooth on, ideally on a charger. It starts
            broadcasting when you start check-in and stops when you end it. Students&apos; phones must hear it to check in, so a photo of the QR
            sent to someone outside the room isn&apos;t enough.
          </span>
        </div>

        <BeaconsEditor
          initial={phones.map((p) => ({
            id: p.id,
            model: p.model,
            manufacturer: p.manufacturer,
            androidSdk: p.androidSdk,
            createdAt: p.createdAt.toISOString(),
            online: p.online,
            state: p.state,
            lastSeenAt: p.lastSeenAt?.toISOString() ?? null,
          }))}
        />
      </main>
    </>
  );
}
