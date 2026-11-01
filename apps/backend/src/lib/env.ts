// Server-only environment access. Read lazily so `next build` works without secrets.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  jwtSecret: () => new TextEncoder().encode(required("JWT_SECRET")),
  allowedLecturerDomains: (): string[] =>
    (process.env.ALLOWED_LECTURER_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  isProduction: () => process.env.NODE_ENV === "production",
};
