import { z } from "zod";
import { handler, readJson } from "@/lib/http";
import { requireDevice } from "@/lib/device-auth";
import { previewRegistration } from "@/server/registration";

const Body = z.object({ token: z.string().min(1).max(200) });

/** After scanning a registration QR: module details and whether registration is open. Nothing is saved. */
export const POST = handler(async (req) => {
  const device = await requireDevice(req);
  const { token } = await readJson(req, Body);
  return previewRegistration(device, token);
});
