"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Trash } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api } from "@/lib/client-api";

export function DangerZone({ moduleId, archived }: { moduleId: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, then: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.push(then);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <section className={`${s.card} ${s.cardPadLg}`} style={{ flex: "1 1 288px", maxWidth: 420 }}>
      <h2 className={s.h2}>Archive or delete</h2>
      <FormError message={error} />
      <p className={s.muted} style={{ margin: 0 }}>
        {archived
          ? "This module is archived. Restore it to show it with your active modules again."
          : "Archive a module at the end of the semester. Its students, sessions and attendance are kept."}
      </p>
      <button
        type="button"
        className="lu-btn"
        disabled={busy}
        onClick={() =>
          run(() => api(`/modules/${moduleId}`, { method: "PATCH", body: { archived: !archived } }), archived ? `/modules/${moduleId}` : "/modules")
        }
      >
        <Archive {...ico} />
        {archived ? "Restore module" : "Archive module"}
      </button>
      <p className={s.muted} style={{ margin: "8px 0 0" }}>
        Deleting removes the module&apos;s roster, sessions and attendance for good.
      </p>
      <button
        type="button"
        className="lu-btn lu-btn--danger"
        disabled={busy}
        onClick={() => {
          if (!confirm("Delete this module with its roster, sessions and attendance? This can't be undone.")) return;
          void run(() => api(`/modules/${moduleId}`, { method: "DELETE" }), "/modules");
        }}
      >
        <Trash {...ico} />
        Delete module
      </button>
    </section>
  );
}
