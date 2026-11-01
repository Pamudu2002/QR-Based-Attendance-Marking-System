import { z } from "zod";
import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { deleteModule, getOwnedModule, ModuleInput, updateModule } from "@/server/modules";

type P = { id: string };

export const GET = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const { regSecret: _secret, ...mod } = await getOwnedModule(lecturerId, params.id);
  return { module: mod };
});

const Patch = ModuleInput.partial().extend({ archived: z.boolean().optional() });

export const PATCH = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const { regSecret: _secret, ...mod } = await updateModule(lecturerId, params.id, await readJson(req, Patch));
  return { module: mod };
});

export const DELETE = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  await deleteModule(lecturerId, params.id);
  return { ok: true };
});
