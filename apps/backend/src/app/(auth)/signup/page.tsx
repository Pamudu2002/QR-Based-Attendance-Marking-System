import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell>
      <AuthForm mode="signup" next={next} />
    </AuthShell>
  );
}
