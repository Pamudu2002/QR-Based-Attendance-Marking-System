import Link from "next/link";
import s from "@/app/styles/portal.module.css";
import { formatTime } from "@/lib/time";
import { moduleShortName } from "@/lib/identity";
import { Brand } from "./Brand";
import { LogoutButton } from "./LogoutButton";
import { SidebarNav } from "./SidebarNav";

type Props = {
  lecturer: { name: string; email: string };
  moduleCount: number;
  today: {
    id: string;
    moduleId: string;
    title: string;
    startsAt: Date;
    venue: string;
    module: { intake: string; semester: string; code: string };
  } | null;
};

function initials(name: string) {
  const words = name.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.at(-1)?.[0] ?? "")).toUpperCase() || "?";
}

export function Sidebar({ lecturer, moduleCount, today }: Props) {
  return (
    <aside className={s.sidebar}>
      <Brand href="/" />
      <SidebarNav moduleCount={moduleCount} />

      <div className={s.sidebarFoot}>
        {today && (
          <div className={s.todayCard}>
            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={s.strong}>Today</span>
              <span className="lu-badge lu-badge--brand">{formatTime(today.startsAt)}</span>
            </span>
            <span className={s.muted}>
              {today.module.code} {today.title} · {today.venue}
            </span>
            <Link className={`lu-btn lu-btn--sm ${s.full}`} href={`/modules/${today.moduleId}/sessions`}>
              Open session
            </Link>
            <span className="sr-only">{moduleShortName(today.module)}</span>
          </div>
        )}
        <div className={s.user}>
          <span className={s.avatar} aria-hidden>
            {initials(lecturer.name)}
          </span>
          <span className={s.userText}>
            <span className={`${s.strong} ${s.ellipsis}`}>{lecturer.name}</span>
            <span className={`${s.small} ${s.muted} ${s.ellipsis}`}>{lecturer.email}</span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
