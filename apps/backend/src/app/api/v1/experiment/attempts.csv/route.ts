import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { attemptsCsv } from "@/server/attendance";

/** Raw per-attempt data for the data package. Device and student ids are pseudonymised. */
export const GET = handler(async (req) => {
  const { header, rows } = await attemptsCsv(await requireLecturerId(req));
  return csvResponse("attempts.csv", toCsv(header, rows));
});
