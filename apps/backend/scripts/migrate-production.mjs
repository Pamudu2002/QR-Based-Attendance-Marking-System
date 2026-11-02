// Vercel build step (package.json "vercel-build"): applies pending Prisma
// migrations on production deployments only. Preview builds share the database,
// so they must never change its schema.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  console.log("Production build: applying database migrations (prisma migrate deploy)");
  execSync("prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}
