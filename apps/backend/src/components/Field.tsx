import { CircleAlert } from "lucide-react";
import s from "@/app/styles/portal.module.css";

/** Label + control + inline error, as in the design forms. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={s.field}>
      {label}
      {children}
      {error ? (
        <span role="alert" className={s.fieldError}>
          <CircleAlert size={14} strokeWidth={1.75} aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className={s.fieldHint}>{hint}</span>
      ) : null}
    </label>
  );
}

/** Form-level message. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="lu-notice lu-notice--danger" role="alert" style={{ maxWidth: "none" }}>
      <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
      <span>{message}</span>
    </div>
  );
}
