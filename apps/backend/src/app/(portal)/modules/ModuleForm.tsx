"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { api, ClientApiError } from "@/lib/client-api";

type Values = { intake: string; semester: string; code: string; name: string };

/** Create (no `moduleId`) or edit a module. */
export function ModuleForm({ moduleId, initial }: { moduleId?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial ?? { intake: "", semester: "", code: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const short = `${v.intake || "In22"}-${v.semester || "S7"}-${(v.code || "CS0000").toUpperCase()}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      if (moduleId) {
        await api(`/modules/${moduleId}`, { method: "PATCH", body: v });
        router.push(`/modules/${moduleId}`);
      } else {
        const res = await api<{ module: { id: string } }>("/modules", { body: v });
        router.push(`/modules/${res.module.id}`);
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && Object.keys(err.fieldErrors).length) setFieldErrors(err.fieldErrors);
      else setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate style={{ gap: 14 }}>
      <FormError message={error} />
      <div className={s.grid2}>
        <Field label="Intake" error={fieldErrors.intake?.[0]}>
          <input className="lu-input" value={v.intake} onChange={set("intake")} placeholder="In22" aria-invalid={!!fieldErrors.intake} />
        </Field>
        <Field label="Semester" error={fieldErrors.semester?.[0]}>
          <input className="lu-input" value={v.semester} onChange={set("semester")} placeholder="S7" aria-invalid={!!fieldErrors.semester} />
        </Field>
      </div>
      <Field label="Module code" error={fieldErrors.code?.[0]}>
        <input className="lu-input" value={v.code} onChange={set("code")} placeholder="CS4473" aria-invalid={!!fieldErrors.code} />
      </Field>
      <Field label="Module name" error={fieldErrors.name?.[0]}>
        <input
          className="lu-input"
          value={v.name}
          onChange={set("name")}
          placeholder="For example, Mobile Computing"
          aria-invalid={!!fieldErrors.name}
        />
      </Field>
      <div className={s.sunkenBox}>
        Shown as{" "}
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>
          {short} - {v.name || "[Module name]"}
        </span>
      </div>
      <button type="submit" className={`lu-btn lu-btn--primary ${s.full}`} disabled={busy}>
        {moduleId ? (busy ? "Saving…" : "Save changes") : busy ? "Creating…" : "Create module"}
      </button>
    </form>
  );
}
