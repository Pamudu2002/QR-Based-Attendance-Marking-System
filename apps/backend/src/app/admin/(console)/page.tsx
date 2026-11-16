import s from "@/app/styles/portal.module.css";
import { requireAdmin } from "@/lib/auth";
import { listLecturers } from "@/server/lecturers";
import { LecturersAdmin } from "./LecturersAdmin";

export const metadata = { title: "Lecturers" };

export default async function AdminPage() {
  await requireAdmin();
  const lecturers = await listLecturers();
  const waiting = lecturers.filter((l) => l.status !== "ACTIVE").length;

  return (
    <main className={`${s.main} ${s.mainLoose}`}>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>Lecturers</h1>
          <p className={s.sub}>
            {lecturers.length} {lecturers.length === 1 ? "account" : "accounts"} · {waiting} waiting for first login
          </p>
        </div>
      </div>
      <LecturersAdmin rows={lecturers} />
    </main>
  );
}
