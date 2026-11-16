"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { api, ClientApiError } from "@/lib/client-api";

type Values = { intake: string; semester: string; code: string; name: string };

/** "In22" → "22", "S7" → "7": the form holds only the numbers. */
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Create (no `moduleId`) or edit a module. The lecturer types only the intake
 * and semester numbers; "In" and "S" are fixed in the boxes and added on save.
 */
export function ModuleForm({ moduleId, initial }: { moduleId?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(
    initial ? { ...initial, intake: digits(initial.intake), semester: digits(initial.semester) } : { intake: "", semester: "", code: "", name: "" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const setNumber = (k: "intake" | "semester", max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: digits(e.target.value).slice(0, max) });
  const short = `In${v.intake || "22"}-S${v.semester || "7"}-${(v.code || "CS0000").toUpperCase()}`;
  const body = { ...v, intake: `In${v.intake}`, semester: `S${v.semester}` };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      if (moduleId) {
        await api(`/modules/${moduleId}`, { method: "PATCH", body });
        router.push(`/modules/${moduleId}`);
      } else {
        const res = await api<{ module: { id: string } }>("/modules", { body });
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
          <span className={s.prefixInput}>
            <span aria-hidden>In</span>
            <input
              className="lu-input"
              value={v.intake}
              onChange={setNumber("intake", 2)}
              placeholder="22"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-invalid={!!fieldErrors.intake}
              style={{ paddingLeft: 32 }}
            />
          </span>
        </Field>
        <Field label="Semester" error={fieldErrors.semester?.[0]}>
          <span className={s.prefixInput}>
            <span aria-hidden>S</span>
            <input
              className="lu-input"
              value={v.semester}
              onChange={setNumber("semester", 2)}
              placeholder="7"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-invalid={!!fieldErrors.semester}
              style={{ paddingLeft: 26 }}
            />
          </span>
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
