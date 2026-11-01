"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { icoMd } from "./icon";

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setTheme(next);
  }

  return (
    <button type="button" className="lu-iconbtn" aria-label="Switch light or dark theme" title="Switch theme" onClick={toggle}>
      {theme === "dark" ? <Sun {...icoMd} /> : <Moon {...icoMd} />}
    </button>
  );
}
