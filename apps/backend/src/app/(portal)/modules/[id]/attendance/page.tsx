import { Info } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ico } from "@/components/icon";
import { loadModule } from "../load";

export const metadata = { title: "Attendance" };

export default async function AttendanceTab({ params }: { params: Promise<{ id: string }> }) {
  await loadModule((await params).id);
  return (
    <div className={`${s.card} ${s.empty}`}>
      <Info {...ico} />
      <span className={s.strong} style={{ color: "var(--ink)" }}>
        No attendance yet
      </span>
      <span>The student × session table and the 80% line show here after the first check-in.</span>
    </div>
  );
}
