import Link from "next/link";
import { ChevronRight } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { ThemeToggle } from "./ThemeToggle";

export type Crumb = { label: string; href?: string };

export function Topbar({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <header className={s.topbar}>
      <nav aria-label="Breadcrumb" className={s.crumbs}>
        <Link href="/">Home</Link>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "contents" }}>
            <ChevronRight size={14} strokeWidth={1.75} aria-hidden />
            {c.href && i < crumbs.length - 1 ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span className={s.crumbCurrent} aria-current="page">
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className={s.actions} style={{ gap: 4 }}>
        <ThemeToggle />
      </div>
    </header>
  );
}
