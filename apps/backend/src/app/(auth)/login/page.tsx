import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Log in" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell>
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
