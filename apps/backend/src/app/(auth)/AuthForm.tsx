"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api, ClientApiError } from "@/lib/client-api";
import { safeNext } from "@/lib/safe-next";

type Audience = "lecturer" | "admin";

const COPY: Record<Audience, { endpoint: string; title: string; sub: string; home: string }> = {
  lecturer: { endpoint: "/auth/lecturer/login", title: "Log in to CSE Attendance", sub: "Lecturer account", home: "/" },
  admin: { endpoint: "/auth/admin/login", title: "Log in to the admin portal", sub: "Admin account", home: "/admin" },
};

export function AuthForm({ audience = "lecturer", next }: { audience?: Audience; next?: string }) {
  const copy = COPY[audience];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  // The form only works once the page's script has loaded. Until then the
  // button stays disabled, so the browser can't submit the form on its own.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await api<{ mustChangePassword?: boolean }>(copy.endpoint, {
        body: {
          email: form.get("email"),
          password: form.get("password"),
          keepLoggedIn: form.get("keep") === "on",
        },
      });
      const target = safeNext(next, copy.home);
      window.location.href = res.mustChangePassword
        ? `/change-password?${new URLSearchParams({ next: target })}`
        : target;
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

  return (
    // method="post": even a native submit never puts the password in the URL.
    <form aria-labelledby="auth-title" className={s.authForm} onSubmit={submit} method="post" noValidate>
      <div>
        <h2 id="auth-title" className={s.h1}>
          {copy.title}
        </h2>
        <p className={s.sub}>{copy.sub}</p>
      </div>
      {audience === "lecturer" && (
        <div className="lu-notice lu-notice--info" role="note" style={{ maxWidth: "none" }}>
          <Info {...ico} />
          <span>Students don&apos;t log in here. They use the Android app.</span>
        </div>
      )}
      <FormError message={error} />

      <Field label="Email" error={fieldErrors.email?.[0]}>
        <input className="lu-input" type="email" name="email" autoComplete="email" required />
      </Field>
      <Field label="Password" error={fieldErrors.password?.[0]}>
        <input className="lu-input" type="password" name="password" autoComplete="current-password" required />
      </Field>
      <label className="lu-check">
        <input type="checkbox" name="keep" defaultChecked={audience === "lecturer"} />
        Keep me logged in
      </label>
      <button type="submit" className={`lu-btn lu-btn--primary ${s.full}`} disabled={busy || !ready}>
        {busy ? "Logging in…" : "Log in"}
      </button>
      <p className={s.muted} style={{ margin: 0, textAlign: "center" }}>
        {audience === "lecturer" ? (
          "New lecturer? Ask the department admin to add your account."
        ) : (
          <>
            Lecturer?{" "}
            <Link className={s.link} href="/login">
              Log in to the lecturer portal
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
