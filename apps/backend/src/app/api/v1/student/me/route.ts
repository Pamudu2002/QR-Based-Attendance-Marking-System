import { handler } from "@/lib/http";
import { requireDevice } from "@/lib/device-auth";
import { studentMe } from "@/server/student-app";

export const GET = handler(async (req) => studentMe(await requireDevice(req)));
