import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { importCommit, importDryRun, ImportInput } from "@/server/roster";

type P = { id: string };

/** ?dryRun=1 returns the preview. Without it, saves in one transaction. */
export const POST = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const body = await readJson(req, ImportInput);
  if (req.nextUrl.searchParams.get("dryRun") === "1") {
    return importDryRun(lecturerId, params.id, body.csv);
  }
  return importCommit(lecturerId, params.id, body);
});
