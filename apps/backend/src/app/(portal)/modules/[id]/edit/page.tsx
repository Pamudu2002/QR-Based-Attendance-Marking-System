import s from "@/app/styles/portal.module.css";
import { ModuleForm } from "../../ModuleForm";
import { loadModule } from "../load";
import { DangerZone } from "./DangerZone";

export const metadata = { title: "Edit module" };

export default async function EditModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mod } = await loadModule(id);
  return (
    <div className={s.split}>
      <section className={`${s.card} ${s.cardPadLg}`} style={{ flex: "1 1 360px", maxWidth: 480 }}>
        <h2 className={s.h2}>Module details</h2>
        <ModuleForm
          moduleId={id}
          initial={{ intake: mod.intake, semester: mod.semester, code: mod.code, name: mod.name }}
        />
      </section>
      <DangerZone moduleId={id} archived={!!mod.archivedAt} />
    </div>
  );
}
