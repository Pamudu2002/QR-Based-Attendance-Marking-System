import s from "@/app/styles/portal.module.css";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/auth";

/** Admin pages: one header, no lecturer sidebar. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-sunken)", color: "var(--ink)" }}>
      <header className={s.topbar}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span className={s.brandLarge} style={{ fontSize: 18, lineHeight: "24px" }}>
            CSE <span>Attendance</span>
          </span>
          <span className="lu-badge lu-badge--brand">Admin</span>
        </span>
        <span className={s.actions} style={{ gap: 4, minWidth: 0 }}>
          <span className={`${s.small} ${s.muted} ${s.ellipsis}`} style={{ marginRight: 8 }}>
            {admin.email}
          </span>
          <ThemeToggle />
          <LogoutButton admin />
        </span>
      </header>
      <div style={{ display: "flex", justifyContent: "center" }}>{children}</div>
    </div>
  );
}
