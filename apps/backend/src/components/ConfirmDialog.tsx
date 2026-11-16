"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import s from "./ConfirmDialog.module.css";

export type ConfirmOptions = {
  /** A question in sentence case, e.g. "Delete Lecture 9?" */
  title: string;
  /** What happens, in one or two sentences. */
  body?: React.ReactNode;
  /** Starts with a verb, e.g. "Delete session". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button and a warning icon; focus starts on Cancel. */
  danger?: boolean;
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;
type Request = ConfirmOptions & { resolve: (confirmed: boolean) => void };

const ConfirmContext = createContext<Ask | null>(null);

/**
 * Themed replacement for window.confirm (Lumora `lu-dialog`). A native
 * <dialog> opened with showModal(), so Esc, the focus trap and returning
 * focus to the opener come from the browser.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const ask = useCallback<Ask>((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);

  useEffect(() => {
    const dialog = ref.current;
    if (!request || !dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
  }, [request]);

  function close(confirmed: boolean) {
    if (!request) return;
    ref.current?.close();
    request.resolve(confirmed);
    setRequest(null);
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {request && (
        <dialog
          ref={ref}
          className={`lu-dialog ${s.dialog}`}
          aria-labelledby={titleId}
          aria-describedby={request.body ? bodyId : undefined}
          onCancel={(e) => {
            e.preventDefault();
            close(false);
          }}
          // A click on the backdrop lands on the <dialog> itself.
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className="lu-dialog__head">
            {request.danger && <TriangleAlert size={18} strokeWidth={1.75} className={s.dangerIcon} aria-hidden />}
            <h2 id={titleId} className="lu-dialog__title">
              {request.title}
            </h2>
          </div>
          {request.body && (
            <div id={bodyId} className="lu-dialog__body">
              <p>{request.body}</p>
            </div>
          )}
          <div className="lu-dialog__foot">
            <button type="button" className="lu-btn" onClick={() => close(false)} data-autofocus={request.danger ? "" : undefined}>
              {request.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              className={`lu-btn ${request.danger ? "lu-btn--danger" : "lu-btn--primary"}`}
              onClick={() => close(true)}
              data-autofocus={request.danger ? undefined : ""}
            >
              {request.confirmLabel}
            </button>
          </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}

/** `if (!(await confirm({ ... }))) return;` */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm needs a ConfirmProvider (the root layout has one).");
  return ask;
}
