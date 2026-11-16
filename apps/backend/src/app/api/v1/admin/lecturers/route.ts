import { handler, readJson } from "@/lib/http";
import { requireAdminId } from "@/lib/auth";
import { createLecturer, LecturerInput, listLecturers } from "@/server/lecturers";

export const GET = handler(async (req) => {
  await requireAdminId(req);
  return { lecturers: await listLecturers() };
});

/** Creates a lecturer with a temporary password, returned once. */
export const POST = handler(async (req) => {
  const adminId = await requireAdminId(req);
  const body = await readJson(req, LecturerInput);
  return createLecturer(adminId, body);
});
