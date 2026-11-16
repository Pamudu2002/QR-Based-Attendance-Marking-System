"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { ico } from "./icon";

export type ActionMenuItem = { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean };

const GAP = 4;
const EDGE = 8;

/**
 * A "…" button with a small menu. The menu is rendered at the page level with
 * fixed positioning, so a scrolling table (overflow) can't clip it, and it opens
 * upwards when there's no room below. It follows the button when the page
 * scrolls; Esc, an outside click, or the button leaving the screen close it.
 */
export function ActionMenu({ label, items, disabled }: { label: string; items: ActionMenuItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function close(focusTrigger: boolean) {
    setOpen(false);
    setPos(null);
    if (focusTrigger) trigger.current?.focus({ preventScroll: true });
  }

  /** Below the button, or above it if it won't fit. Closes if the button has scrolled away. */
  function place() {
    if (!trigger.current || !menu.current) return;
    const t = trigger.current.getBoundingClientRect();
    if (t.bottom < 0 || t.top > window.innerHeight) return close(false);
    const m = menu.current.getBoundingClientRect();
    const below = t.bottom + GAP + m.height <= window.innerHeight - EDGE;
    const top = below ? t.bottom + GAP : Math.max(EDGE, t.top - GAP - m.height);
    const left = Math.min(Math.max(EDGE, t.right - m.width), window.innerWidth - m.width - EDGE);
    setPos({ top, left });
  }

  // Measure and place it as soon as it's rendered (it stays hidden until then).
  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  // Focus the first item once it's visible: a hidden element can't take focus.
  const placed = pos !== null;
  useEffect(() => {
    if (open && placed) menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open, placed]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus({ preventScroll: true });
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="lu-iconbtn lu-iconbtn--sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        style={{ verticalAlign: "middle" }}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <Ellipsis {...ico} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{
              position: "fixed",
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              // Hidden for the first frame, until it's measured and placed.
              visibility: pos ? "visible" : "hidden",
              zIndex: 50,
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-popover)",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              minWidth: 180,
              textAlign: "left",
            }}
          >
            {items.map(({ label: text, icon: Icon, onSelect, danger }) => (
              <button
                key={text}
                type="button"
                role="menuitem"
                className="lu-btn lu-btn--ghost lu-btn--sm"
                style={{ justifyContent: "flex-start", ...(danger ? { color: "var(--danger)" } : {}) }}
                onClick={() => {
                  close(false);
                  onSelect();
                }}
              >
                <Icon {...ico} />
                {text}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
