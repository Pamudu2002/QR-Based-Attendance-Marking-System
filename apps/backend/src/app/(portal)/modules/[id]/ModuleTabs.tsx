"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "@/app/styles/portal.module.css";

export function ModuleTabs({ moduleId }: { moduleId: string }) {
  const path = usePathname();
  const base = `/modules/${moduleId}`;
  const tabs = [
    { href: base, label: "Students", active: path === base || path === `${base}/import` },
    { href: `${base}/registration`, label: "Registration", active: path === `${base}/registration` },
    { href: `${base}/sessions`, label: "Sessions", active: path === `${base}/sessions` },
    { href: `${base}/attendance`, label: "Attendance", active: path === `${base}/attendance` },
  ];
  return (
    <nav aria-label="Module sections" className={s.tabs}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`lu-group ${t.active ? "is-active" : ""}`} aria-current={t.active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
