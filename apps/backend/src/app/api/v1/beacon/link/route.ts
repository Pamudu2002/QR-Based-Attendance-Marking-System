import { handler, readJson } from "@/lib/http";
import { BeaconLinkInput, linkBeaconPhone } from "@/server/beacons";

/** Beacon app setup: the scanned link code, the phone's Keystore public key, and a signature proving it holds the key. */
export const POST = handler(async (req) => {
  const linked = await linkBeaconPhone(await readJson(req, BeaconLinkInput));
  return Response.json(linked, { status: 201 });
});
