import { handler, readJson } from "@/lib/http";
import { createDevice, DeviceInput } from "@/server/student-app";

/** App setup: registers the phone's Keystore public key. No login needed; the device starts unbound. */
export const POST = handler(async (req) => {
  const device = await createDevice(await readJson(req, DeviceInput));
  return Response.json({ deviceId: device.id, device }, { status: 201 });
});
