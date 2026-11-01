import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { createModule, listModules, ModuleInput } from "@/server/modules";

export const GET = handler(async (req) => {
  const lecturerId = await requireLecturerId(req);
  const archived = req.nextUrl.searchParams.get("archived") === "1";
  return { modules: await listModules(lecturerId, { archived }) };
});

export const POST = handler(async (req) => {
  const lecturerId = await requireLecturerId(req);
  const { regSecret: _secret, ...mod } = await createModule(lecturerId, await readJson(req, ModuleInput));
  return Response.json({ module: mod }, { status: 201 });
});
