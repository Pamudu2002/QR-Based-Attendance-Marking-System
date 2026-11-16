// Creates an admin account, or sets a new password for an existing one.
// Admins can only be made here, never in the portal.
//
//   pnpm --filter @attendance/backend admin:create
//
// Asks for the email, name and password (the password isn't shown as you type).
// For scripts, set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD instead, plus --yes
// to skip the confirmation for a non-local database.
//
// Uses DATABASE_URL from the shell, else from apps/backend/.env.
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const MIN_ADMIN_PASSWORD = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const yes = process.argv.includes("--yes");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it. */
function askHidden(question: string): Promise<string> {
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let value = "";
    const done = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          done();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          done();
          process.exit(130); // Ctrl+C
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

/** Host and database name only, never the credentials. */
function describeDb(url: string): { label: string; local: boolean } {
  try {
    const u = new URL(url);
    return { label: `${u.hostname}${u.pathname}`, local: u.hostname === "localhost" || u.hostname === "127.0.0.1" };
  } catch {
    fail("DATABASE_URL isn't a valid URL.");
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail("Set DATABASE_URL (in the shell or apps/backend/.env) first.");
  const target = describeDb(url);
  const interactive = stdin.isTTY === true;

  const email = (process.env.ADMIN_EMAIL ?? (interactive ? await ask("Admin email: ") : "")).toLowerCase();
  if (!EMAIL_RE.test(email)) fail("Enter a valid email address.");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const existing = await db.admin.findUnique({ where: { email } });

    let name = process.env.ADMIN_NAME ?? existing?.name ?? "";
    if (!process.env.ADMIN_NAME && interactive) {
      name = (await ask(existing ? `Name [${existing.name}]: ` : "Name: ")) || name;
    }
    if (!name.trim()) fail("Enter a name.");

    let password = process.env.ADMIN_PASSWORD ?? "";
    if (!password) {
      if (!interactive) fail("Set ADMIN_PASSWORD, or run this in a terminal.");
      password = await askHidden(`Password (at least ${MIN_ADMIN_PASSWORD} characters): `);
      if (password !== (await askHidden("Repeat the password: "))) fail("The passwords don't match.");
    }
    if (password.length < MIN_ADMIN_PASSWORD) fail(`Use at least ${MIN_ADMIN_PASSWORD} characters.`);

    const action = existing ? `Set a new password for admin ${email}` : `Create admin ${email}`;
    if (!target.local && !yes) {
      if (!interactive) fail(`${target.label} isn't a local database. Add --yes to continue.`);
      const answer = await ask(`${action} on ${target.label}? Type yes to continue: `);
      if (answer.toLowerCase() !== "yes") fail("Nothing changed.");
    }

    const passwordHash = await hash(password);
    await db.admin.upsert({
      where: { email },
      create: { email, name: name.trim(), passwordHash },
      update: { name: name.trim(), passwordHash },
    });
    if (existing) {
      // A new password ends the admin's other sessions.
      await db.refreshToken.updateMany({ where: { adminId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    console.log(`${existing ? "Updated" : "Created"} admin ${email} on ${target.label}. Log in at /admin/login.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
