"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { Field, FormError } from "@/components/Field";
import { ico } from "@/components/icon";
import { api, ClientApiError } from "@/lib/client-api";
import { safeNext } from "@/lib/safe-next";

type Mode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
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
      await api(mode === "login" ? "/auth/lecturer/login" : "/auth/lecturer/signup", {
        body: {
          ...(mode === "signup" ? { name: form.get("name") } : {}),
          email: form.get("email"),
          password: form.get("password"),
          keepLoggedIn: form.get("keep") === "on",
        },
      });
      window.location.href = safeNext(next);
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

  const otherHref = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  return (
    // method="post": even a native submit never puts the password in the URL.
    <form aria-labelledby="auth-title" className={s.authForm} onSubmit={submit} method="post" noValidate>
      <div>
        <h2 id="auth-title" className={s.h1}>
          {mode === "login" ? "Log in to CSE Attendance" : "Create a lecturer account"}
        </h2>
        <p className={s.sub}>Lecturer account</p>
      </div>
      <div className="lu-notice lu-notice--info" role="note" style={{ maxWidth: "none" }}>
        <Info {...ico} />
        <span>Students don&apos;t log in here. They use the Android app.</span>
      </div>
      <FormError message={error} />

      {mode === "signup" && (
        <Field label="Your name" error={fieldErrors.name?.[0]}>
          <input className="lu-input" name="name" autoComplete="name" placeholder="Dr. N. Ranasinghe" required />
        </Field>
      )}
      <Field label="Email" error={fieldErrors.email?.[0]}>
        <input className="lu-input" type="email" name="email" autoComplete="email" required />
      </Field>
      <Field
        label="Password"
        error={fieldErrors.password?.[0]}
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      >
        <input
          className="lu-input"
          type="password"
          name="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </Field>
      <label className="lu-check">
        <input type="checkbox" name="keep" defaultChecked />
        Keep me logged in
      </label>
      <button type="submit" className={`lu-btn lu-btn--primary ${s.full}`} disabled={busy || !ready}>
        {mode === "login" ? (busy ? "Logging in…" : "Log in") : busy ? "Creating account…" : "Create account"}
      </button>
      <p className={s.muted} style={{ margin: 0, textAlign: "center" }}>
        {mode === "login" ? (
          <>
            New lecturer?{" "}
            <Link className={s.link} href={otherHref("/signup")}>
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link className={s.link} href={otherHref("/login")}>
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
