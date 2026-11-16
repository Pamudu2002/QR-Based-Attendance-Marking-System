"use client";

import { LogOut } from "lucide-react";
import { api } from "@/lib/client-api";
import { ico } from "./icon";

export function LogoutButton({ admin = false }: { admin?: boolean }) {
  async function logout() {
    await api(admin ? "/auth/admin/logout" : "/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = admin ? "/admin/login" : "/login";
  }
  return (
    <button type="button" className="lu-iconbtn" aria-label="Log out" title="Log out" onClick={logout}>
      <LogOut {...ico} />
    </button>
  );
}
