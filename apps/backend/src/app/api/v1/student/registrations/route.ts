import { handler, readJson } from "@/lib/http";
import { requireDevice } from "@/lib/device-auth";
import { registerForModule, RegistrationInput } from "@/server/registration";

/** Signed registration for a module. Always 200 with a verdict, unless the request itself is bad. */
export const POST = handler(async (req) => {
  const device = await requireDevice(req);
  return registerForModule(device, await readJson(req, RegistrationInput));
});
