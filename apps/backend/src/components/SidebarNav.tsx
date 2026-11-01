"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Calendar, LayoutDashboard } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ico } from "./icon";

export function SidebarNav({ moduleCount }: { moduleCount: number }) {
  const path = usePathname();
  const item = (active: boolean) => `${s.navItem} ${active ? s.navItemActive : ""}`;
  const isSessions = path === "/sessions" || /^\/modules\/[^/]+\/sessions/.test(path);

  return (
    <nav aria-label="Main menu" style={{ display: "contents" }}>
      <Link href="/" className={item(path === "/")} aria-current={path === "/" ? "page" : undefined}>
        <LayoutDashboard {...ico} />
        Dashboard
      </Link>
      <span className={s.navHeading}>Teaching</span>
      <Link href="/modules" className={item(path.startsWith("/modules") && !isSessions)}>
        <Book {...ico} />
        <span style={{ flex: 1 }}>Modules</span>
        <span className="lu-badge">{moduleCount}</span>
      </Link>
      <Link href="/sessions" className={item(isSessions)}>
        <Calendar {...ico} />
        Sessions
      </Link>
    </nav>
  );
}
