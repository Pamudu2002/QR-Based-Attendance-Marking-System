import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireLecturer } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { AuthShell } from "../AuthShell";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Set a new password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const lecturer = await requireLecturer({ allowPasswordChange: true });
  const next = safeNext((await searchParams).next);
  if (!lecturer.mustChangePassword) redirect(next);
  return (
    <AuthShell>
      <ChangePasswordForm email={lecturer.email} next={next} />
    </AuthShell>
  );
}
