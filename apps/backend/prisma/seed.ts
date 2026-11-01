// Demo data for local development: one lecturer, three modules, a roster,
// weekly sessions and some attendance. Run with `pnpm --filter @attendance/backend db:seed`.
// Re-running replaces the demo lecturer's data. Refuses to run on a non-local database.
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, utcToZoned, weekday, zonedToUtc } from "../src/lib/time";

export const DEMO_EMAIL = "demo@uom.lk";
export const DEMO_PASSWORD = "demo-pass-2026";
const DEMO_KEY = "SEED-DEMO-KEY";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error("Refusing to seed: DATABASE_URL is not a local database. Set SEED_ALLOW_REMOTE=1 to override.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// Sample data from design/screens.
const STUDENTS: [index: string, name: string, phone: string | null, sdk: number][] = [
  ["220366X", "Lokuhewa P. C.", "Galaxy A14", 34],
  ["220720E", "Wijesinghe L. A. V. B.", "Pixel 7", 35],
  ["220101A", "Perera K. D.", "Redmi Note 12", 33],
  ["220245K", "Fernando S. M.", "Galaxy S21", 34],
  ["220512P", "Jayasinghe R. T.", null, 0],
  ["220633N", "Senanayake H. M.", "Nokia G21", 31],
  ["220188D", "Wickramasinghe D. S.", null, 0],
  ["220402H", "Bandara M. P.", "Vivo Y21", 30],
  ["220557L", "Rathnayake A. K.", null, 0],
  ["220719B", "Herath S. D.", "Oppo A57", 33],
];

/** Dates (YYYY-MM-DD) of `day` (0 = Sunday) from `weeksBack` weeks ago, `count` weeks in a row. */
function weekly(day: number, weeksBack: number, count: number): string[] {
  const today = utcToZoned(new Date()).date;
  const thisWeek = addDays(today, day - weekday(today));
  return Array.from({ length: count }, (_, i) => addDays(thisWeek, (i - weeksBack) * 7));
}

async function main() {
  await db.lecturer.deleteMany({ where: { email: DEMO_EMAIL } });
  await db.device.deleteMany({ where: { publicKey: DEMO_KEY } });

  const lecturer = await db.lecturer.create({
    data: { name: "Dr. N. Ranasinghe", email: DEMO_EMAIL, passwordHash: await hash(DEMO_PASSWORD) },
  });

  const mk = (code: string, name: string, open: boolean) =>
    db.module.create({
      data: { lecturerId: lecturer.id, intake: "In22", semester: "S7", code, name, registrationOpen: open, regSecret: `seed-${code}` },
    });
  const cs4473 = await mk("CS4473", "Mobile Computing", true);
  const cs4580 = await mk("CS4580", "Advanced Data Structures", false);
  const ma4160 = await mk("MA4160", "Advanced Operational Research", true);

  const students = [];
  for (const [index, , phone, sdk] of STUDENTS) {
    const student = await db.student.upsert({ where: { indexNumber: index }, create: { indexNumber: index }, update: {} });
    // Reuse a phone already bound to this index (e.g. a real test phone), else add a demo one.
    const device = phone
      ? (await db.device.findFirst({ where: { studentId: student.id, status: "ACTIVE" } })) ??
        (await db.device.create({
          data: {
            studentId: student.id,
            publicKey: DEMO_KEY,
            keyLevel: "TEE",
            model: phone,
            manufacturer: phone.split(" ")[0]!,
            androidSdk: sdk,
            boundAt: new Date(),
          },
        }))
      : null;
    students.push({ student, device });
  }

  // CS4473: everyone. The others: part of the class, so the modules differ.
  const firstClass = zonedToUtc(weekly(2, 1, 1)[0]!, "10:05");
  for (const [i, { student, device }] of students.entries()) {
    await db.rosterEntry.create({
      data: {
        moduleId: cs4473.id,
        studentId: student.id,
        rosterName: STUDENTS[i]![1],
        addedVia: i < 8 ? "CSV" : "MANUAL",
        registeredAt: device ? new Date(firstClass.getTime() + i * 60_000) : null,
        registeredDeviceId: device?.id ?? null,
      },
    });
  }
  for (const [moduleId, from, to] of [
    [cs4580.id, 0, 6],
    [ma4160.id, 3, 10],
  ] as const) {
    for (let i = from; i < to; i++) {
      const { student, device } = students[i]!;
      await db.rosterEntry.create({
        data: {
          moduleId,
          studentId: student.id,
          rosterName: STUDENTS[i]![1],
          addedVia: "CSV",
          registeredAt: device && i % 2 === 0 ? new Date() : null,
          registeredDeviceId: device && i % 2 === 0 ? device.id : null,
        },
      });
    }
  }

  // Weekly sessions: 4 past and 4 upcoming per module.
  const series = [
    { mod: cs4473, day: 2, start: "10:15", end: "12:15", venue: "Lecture Hall A", first: 5 },
    { mod: cs4580, day: 4, start: "13:15", end: "15:15", venue: "Lab 2", first: 5 },
    { mod: ma4160, day: 1, start: "08:15", end: "10:15", venue: "Lecture Hall C", first: 6 },
  ];
  const now = new Date();
  for (const s of series) {
    const dates = weekly(s.day, 4, 8);
    for (const [n, date] of dates.entries()) {
      const startsAt = zonedToUtc(date, s.start);
      const session = await db.session.create({
        data: {
          moduleId: s.mod.id,
          title: `Lecture ${s.first + n}`,
          startsAt,
          endsAt: zonedToUtc(date, s.end),
          venue: s.venue,
          expectedSsid: "UniWiFi",
          seriesId: `seed-${s.mod.code}`,
        },
      });
      if (startsAt >= now || s.mod.id !== cs4473.id) continue;

      // Attendance for past CS4473 classes: most present, a few late, some missed.
      for (const [i, { student, device }] of students.entries()) {
        if (!device || (i === 5 && n % 2 === 1) || (i === 3 && n === 2)) continue;
        await db.attendance.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status: i === 2 && n === 1 ? "LATE" : "PRESENT",
            source: "QR",
            markedAt: new Date(startsAt.getTime() + (i + 1) * 60_000),
          },
        });
      }
    }
  }

  // Two failed registrations today, for the Registration panel.
  for (const [indexNumberTyped, verdict] of [
    ["220871C", "NOT_ON_ROSTER"],
    ["220610F", "DEVICE_BOUND_TO_OTHER_STUDENT"],
  ] as const) {
    await db.registrationEvent.create({ data: { moduleId: cs4473.id, indexNumberTyped, verdict } });
  }

  console.log(`Seeded demo data. Log in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
