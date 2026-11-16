import type { Metadata } from "next";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { AuthForm } from "@/app/(auth)/AuthForm";

export const metadata: Metadata = { title: "Admin log in" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell>
      <AuthForm audience="admin" next={next} />
    </AuthShell>
  );
}
