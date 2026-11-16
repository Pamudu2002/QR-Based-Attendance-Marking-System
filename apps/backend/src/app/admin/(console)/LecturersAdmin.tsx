"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clock, Copy, Mail, TriangleAlert, X } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { ico, icoXs } from "@/components/icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { api, ClientApiError } from "@/lib/client-api";
import type { AccountStatus } from "@/lib/lecturer-account";
import { formatDay, formatDayTime } from "@/lib/time";

export type LecturerRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  status: AccountStatus;
  tempPasswordExpiresAt: Date | null;
  modules: number;
};

type Issued = {
  lecturer: { id: string; name: string; email: string };
  tempPassword: string;
  expiresAt: string;
  kind: "created" | "reset";
};

function StatusBadge({ status }: { status: AccountStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="lu-badge lu-badge--success">
        <Check {...icoXs} />
        Active
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="lu-badge lu-badge--warning">
        <Clock {...icoXs} />
        Waiting for first login
      </span>
    );
  }
  return (
    <span className="lu-badge lu-badge--danger">
      <X {...icoXs} />
      Temporary password expired
    </span>
  );
}

/** A message in the admin's own mail app, so it comes from their university address. */
function mailtoLink(issued: Issued, origin: string) {
  const expires = formatDayTime(new Date(issued.expiresAt));
  const subject = "Your CSE Attendance account";
  const body = [
    `Hello ${issued.lecturer.name},`,
    "",
    issued.kind === "created"
      ? "An account has been created for you on CSE Attendance."
      : "Your CSE Attendance password has been reset.",
    "",
    `Portal: ${origin}/login`,
    `Email: ${issued.lecturer.email}`,
    `Temporary password: ${issued.tempPassword}`,
    "",
    `You'll set your own password when you log in. This temporary password expires on ${expires}.`,
  ].join("\n");
  return `mailto:${issued.lecturer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The temporary password, shown once after it is made. */
function IssuedPassword({ issued, onHide }: { issued: Issued; onHide: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="issued-title" className={`${s.card} ${s.cardPadLg}`}>
      <div>
        <h2 id="issued-title" className={s.h2}>
          {issued.kind === "created" ? "Account created" : "New password made"} for {issued.lecturer.name}
        </h2>
        <p className={s.sub}>{issued.lecturer.email}</p>
      </div>
      <div className="lu-notice lu-notice--warning" role="status" style={{ maxWidth: "none" }}>
        <TriangleAlert {...ico} />
        <span>
          This password is shown only once. Send it to the lecturer now. It expires on{" "}
          {formatDayTime(new Date(issued.expiresAt))}, and they&apos;ll set their own password when they log in.
        </span>
      </div>
      <pre className={s.code} style={{ fontSize: 16, lineHeight: "24px" }} aria-label="Temporary password">
        {issued.tempPassword}
      </pre>
      <div className={s.actions}>
        <button type="button" className="lu-btn" onClick={copy}>
          {copied ? <Check {...ico} /> : <Copy {...ico} />}
          {copied ? "Copied" : "Copy password"}
        </button>
        <a className="lu-btn" href={mailtoLink(issued, window.location.origin)}>
          <Mail {...ico} />
          Open in email
        </a>
        <button type="button" className="lu-btn lu-btn--ghost" onClick={onHide}>
          Hide password
        </button>
      </div>
    </section>
  );
}

export function LecturersAdmin({ rows }: { rows: LecturerRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [issued, setIssued] = useState<Issued | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<Omit<Issued, "kind">>("/admin/lecturers", { body: { name, email } });
      setIssued({ ...res, kind: "created" });
      setName("");
      setEmail("");
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError && Object.keys(err.fieldErrors).length) setFieldErrors(err.fieldErrors);
      else setError(err instanceof Error ? err.message : "Couldn't add the lecturer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(r: LecturerRow) {
    const note = r.status === "ACTIVE" ? " Their current password stops working and they're logged out." : "";
    const ok = await confirm({
      title: `Make a new temporary password for ${r.name}?`,
      body: `You'll see it once, to pass on to them.${note}`,
      confirmLabel: "Make password",
      danger: r.status === "ACTIVE",
    });
    if (!ok) return;
    setRowBusy(r.id);
    setTableError(null);
    try {
      const res = await api<Omit<Issued, "kind">>(`/admin/lecturers/${r.id}/reset-password`, { method: "POST" });
      setIssued({ ...res, kind: "reset" });
      router.refresh();
    } catch (err) {
      setTableError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <>
      {issued && <IssuedPassword issued={issued} onHide={() => setIssued(null)} />}

      <div className={s.split}>
        <section className={`${s.card} ${s.cardFlush}`} style={{ flex: "999 1 560px", minWidth: 0 }}>
          {tableError && (
            <div className="lu-notice lu-notice--danger" role="alert" style={{ maxWidth: "none", margin: 12 }}>
              <TriangleAlert {...ico} />
              <span>{tableError}</span>
            </div>
          )}
          <div className={s.tableWrap}>
            <table className={s.table} style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Modules</th>
                  <th>Added</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className={s.muted} style={{ textAlign: "center", padding: 24 }}>
                      No lecturers yet. Add the first one with the form.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} style={{ opacity: rowBusy === r.id ? 0.5 : 1 }}>
                    <td className={s.strong}>{r.name}</td>
                    <td>{r.email}</td>
                    <td>
                      <span className={s.cellStack}>
                        <StatusBadge status={r.status} />
                        {r.status === "PENDING" && r.tempPasswordExpiresAt && (
                          <span className={`${s.small} ${s.muted}`}>
                            expires {formatDayTime(new Date(r.tempPasswordExpiresAt))}
                          </span>
                        )}
                      </span>
                    </td>
                    <td>{r.modules}</td>
                    <td className={s.nowrap}>{formatDay(new Date(r.createdAt))}</td>
                    <td className={s.right}>
                      <button
                        type="button"
                        className="lu-btn lu-btn--sm"
                        disabled={rowBusy !== null}
                        onClick={() => reset(r)}
                      >
                        Send new password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <form
          aria-labelledby="al-title"
          className={`${s.card} ${s.cardPadLg}`}
          style={{ flex: "1 1 288px" }}
          onSubmit={add}
          noValidate
        >
          <div>
            <h2 id="al-title" className={s.h2}>
              Add a lecturer
            </h2>
            <p className={s.sub}>They get a temporary password and set their own at first login.</p>
          </div>
          <FormError message={error} />
          <Field label="Name" error={fieldErrors.name?.[0]}>
            <input
              className="lu-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. N. Ranasinghe"
              aria-invalid={!!fieldErrors.name}
              autoComplete="off"
            />
          </Field>
          <Field label="University email" error={fieldErrors.email?.[0]}>
            <input
              className="lu-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ranasinghen@uom.lk"
              aria-invalid={!!fieldErrors.email}
              autoComplete="off"
            />
          </Field>
          <button type="submit" className={`lu-btn lu-btn--primary ${s.full}`} disabled={busy}>
            {busy ? "Adding…" : "Add lecturer"}
          </button>
        </form>
      </div>
    </>
  );
}
