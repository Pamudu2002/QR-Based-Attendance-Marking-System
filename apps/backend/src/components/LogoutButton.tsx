"use client";

import { LogOut } from "lucide-react";
import { api } from "@/lib/client-api";
import { ico } from "./icon";

export function LogoutButton() {
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }
  return (
    <button type="button" className="lu-iconbtn" aria-label="Log out" title="Log out" onClick={logout}>
      <LogOut {...ico} />
    </button>
  );
}
