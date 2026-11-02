import Link from "next/link";
import { Pencil, QrCode, Upload } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Topbar } from "@/components/Topbar";
import { ico } from "@/components/icon";
import { moduleShortName } from "@/lib/identity";
import { loadModule } from "./load";
import { ModuleTabs } from "./ModuleTabs";

export default async function ModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { mod } = await loadModule(id);

  return (
    <>
      <Topbar crumbs={[{ label: "Modules", href: "/modules" }, { label: moduleShortName(mod) }]} />
      <main className={s.main}>
        <div className={s.pageHead}>
          <div>
            <span className={`${s.mono} ${s.muted}`}>{moduleShortName(mod)}</span>
            <h1 className={s.h1} style={{ marginTop: 2 }}>
              {mod.name}
              {mod.archivedAt && (
                <span className="lu-badge" style={{ marginLeft: 8, verticalAlign: "middle" }}>
                  Archived
                </span>
              )}
            </h1>
          </div>
          <div className={s.actions}>
            <a className="lu-btn" href={`/present/register/${id}`} target="_blank" rel="noopener">
              <QrCode {...ico} />
              Show registration QR
            </a>
            <Link className="lu-btn" href={`/modules/${id}/import`}>
              <Upload {...ico} />
              Import CSV
            </Link>
            <Link className="lu-btn lu-btn--ghost" href={`/modules/${id}/edit`}>
              <Pencil {...ico} />
              Edit module
            </Link>
          </div>
        </div>
        <ModuleTabs moduleId={id} />
        {children}
      </main>
    </>
  );
}
