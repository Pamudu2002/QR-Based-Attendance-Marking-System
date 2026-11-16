"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api, ClientApiError } from "@/lib/client-api";
import { MIN_PASSWORD_LENGTH } from "@/lib/lecturer-account";

/** First login: replace the admin's temporary password with the lecturer's own. */
export function ChangePasswordForm({ email, next }: { email: string; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    setError(null);
    setFieldErrors({});
    if (newPassword !== form.get("confirm")) {
      setFieldErrors({ confirm: ["The passwords don't match."] });
      return;
    }
    setBusy(true);
    try {
      await api("/auth/lecturer/change-password", {
        body: { currentPassword: form.get("currentPassword"), newPassword },
      });
      window.location.href = next;
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(Object.keys(err.fieldErrors).length ? null : err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <form aria-labelledby="cp-title" className={s.authForm} onSubmit={submit} method="post" noValidate>
      <div>
        <h2 id="cp-title" className={s.h1}>
          Set a new password
        </h2>
        <p className={s.sub}>{email}</p>
      </div>
      <div className="lu-notice lu-notice--info" role="note" style={{ maxWidth: "none" }}>
        <KeyRound {...ico} />
        <span>You logged in with a temporary password. Choose your own password to continue.</span>
      </div>
      <FormError message={error} />

      {/* Lets password managers save the new password under the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="Temporary password" error={fieldErrors.currentPassword?.[0]}>
        <input className="lu-input" type="password" name="currentPassword" autoComplete="current-password" required />
      </Field>
      <Field
        label="New password"
        error={fieldErrors.newPassword?.[0]}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      >
        <input
          className="lu-input"
          type="password"
          name="newPassword"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </Field>
      <Field label="Confirm new password" error={fieldErrors.confirm?.[0]}>
        <input className="lu-input" type="password" name="confirm" autoComplete="new-password" required />
      </Field>
      <button type="submit" className={`lu-btn lu-btn--primary ${s.full}`} disabled={busy || !ready}>
        {busy ? "Saving…" : "Set password"}
      </button>
      <p className={s.muted} style={{ margin: 0, textAlign: "center" }}>
        Not you?{" "}
        <button type="button" className={`lu-btn lu-btn--ghost lu-btn--sm`} onClick={logout}>
          Log out
        </button>
      </p>
    </form>
  );
}
