"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheck } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api, ClientApiError } from "@/lib/client-api";

export function AddStudentForm({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [indexNumber, setIndex] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [added, setAdded] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setAdded(null);
    try {
      await api(`/modules/${moduleId}/students`, { body: { indexNumber, name } });
      setAdded(`${indexNumber.trim().toUpperCase()} added.`);
      setIndex("");
      setName("");
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && Object.keys(err.fieldErrors).length) setFieldErrors(err.fieldErrors);
      else setError(err instanceof Error ? err.message : "Couldn't add the student. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="add-student" aria-labelledby="as-title" className={`${s.card} ${s.cardPad}`} onSubmit={submit} noValidate>
      <h2 id="as-title" className={s.h2}>
        Add a student
      </h2>
      <FormError message={error} />
      {added && (
        <div className="lu-notice lu-notice--success" role="status" style={{ maxWidth: "none" }}>
          <CircleCheck {...ico} />
          <span>{added}</span>
        </div>
      )}
      <Field label="Index number" error={fieldErrors.indexNumber?.[0]}>
        <input
          className="lu-input"
          value={indexNumber}
          onChange={(e) => setIndex(e.target.value)}
          placeholder="220366X"
          style={{ fontFamily: "var(--font-mono)" }}
          aria-invalid={!!fieldErrors.indexNumber}
          autoComplete="off"
        />
      </Field>
      <Field label="Name" error={fieldErrors.name?.[0]}>
        <input
          className="lu-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lokuhewa P. C."
          aria-invalid={!!fieldErrors.name}
          autoComplete="off"
        />
      </Field>
      <p className={s.muted} style={{ margin: 0 }}>
        The student registers with this name and index number. Capitals, spaces and dots don&apos;t matter.
      </p>
      <button type="submit" className={`lu-btn lu-btn--primary ${s.full}`} disabled={busy}>
        {busy ? "Adding…" : "Add student"}
      </button>
    </form>
  );
}
