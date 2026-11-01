import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { expandWeekly } from "@/lib/series";
import { getOwnedModule } from "./modules";

const SessionFields = z.object({
  title: z.string().trim().min(1, "Enter a title, e.g. Lecture 10.").max(120),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  venue: z.string().trim().min(1, "Enter the venue.").max(120),
  opensBeforeMin: z.number().int().min(0).max(120).default(15),
  lateAfterMin: z.number().int().min(0).max(240).default(15),
  expectedSsid: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .transform((s) => s || null),
  isExperiment: z.boolean().default(false),
});

const endsAfterStarts = (s: { startsAt?: Date; endsAt?: Date }) =>
  !s.startsAt || !s.endsAt || s.endsAt > s.startsAt;
const endsMessage = { message: "The end time must be after the start time.", path: ["endsAt"] };

export const SessionCreate = SessionFields.extend({
  repeatWeeks: z.number().int().min(1).max(20).default(1),
}).refine(endsAfterStarts, endsMessage);

export const SessionUpdate = SessionFields.partial().refine(endsAfterStarts, endsMessage);

export async function getOwnedSession(lecturerId: string, sessionId: string) {
  const session = await db.session.findFirst({
    where: { id: sessionId, module: { lecturerId } },
    include: { module: { select: { id: true, intake: true, semester: true, code: true, name: true } } },
  });
  if (!session) throw ApiError.notFound("Session not found.");
  return session;
}

/** Creates one session, or one per week when repeatWeeks > 1 ("Lecture 10", "Lecture 11", …). */
export async function createSessions(lecturerId: string, moduleId: string, input: z.infer<typeof SessionCreate>) {
  await getOwnedModule(lecturerId, moduleId);
  const { repeatWeeks, ...fields } = input;
  const seriesId = repeatWeeks > 1 ? randomBytes(8).toString("hex") : null;
  const times = expandWeekly(fields, repeatWeeks);

  return db.$transaction(
    times.map((t) => db.session.create({ data: { ...fields, ...t, moduleId, seriesId } })),
  );
}

export async function updateSession(lecturerId: string, sessionId: string, input: z.infer<typeof SessionUpdate>) {
  const current = await getOwnedSession(lecturerId, sessionId);
  const startsAt = input.startsAt ?? current.startsAt;
  const endsAt = input.endsAt ?? current.endsAt;
  if (endsAt <= startsAt) throw ApiError.badRequest("The end time must be after the start time.");
  return db.session.update({ where: { id: sessionId }, data: input });
}

export async function deleteSession(lecturerId: string, sessionId: string) {
  await getOwnedSession(lecturerId, sessionId);
  await db.session.delete({ where: { id: sessionId } });
}

export type SessionListItem = Awaited<ReturnType<typeof listSessions>>[number];

/** Sessions of my modules (or one module) that overlap [from, to). */
export async function listSessions(lecturerId: string, opts: { moduleId?: string; from?: Date; to?: Date } = {}) {
  if (opts.moduleId) await getOwnedModule(lecturerId, opts.moduleId);
  return db.session.findMany({
    where: {
      module: { lecturerId, archivedAt: null },
      ...(opts.moduleId ? { moduleId: opts.moduleId } : {}),
      ...(opts.from ? { endsAt: { gt: opts.from } } : {}),
      ...(opts.to ? { startsAt: { lt: opts.to } } : {}),
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      moduleId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      venue: true,
      opensBeforeMin: true,
      lateAfterMin: true,
      expectedSsid: true,
      isExperiment: true,
      seriesId: true,
      module: { select: { intake: true, semester: true, code: true, name: true } },
    },
  });
}
