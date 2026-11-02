import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection on Neon. The Vercel Neon
    // integration provides it as DATABASE_URL_UNPOOLED.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL_UNPOOLED"] || process.env["DATABASE_URL"] || "",
  },
});
