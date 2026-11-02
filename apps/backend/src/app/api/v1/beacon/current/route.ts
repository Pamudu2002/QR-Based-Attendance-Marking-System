import { handler } from "@/lib/http";
import { beaconCurrent, requireBeaconPhone } from "@/server/beacons";

/** Polled by the beacon phone every 2 s: `?state=waiting|broadcasting|bluetooth_off|…` → the run to broadcast, or null. */
export const GET = handler(async (req) => {
  const phone = await requireBeaconPhone(req);
  return beaconCurrent(phone, req.nextUrl.searchParams.get("state"));
});
