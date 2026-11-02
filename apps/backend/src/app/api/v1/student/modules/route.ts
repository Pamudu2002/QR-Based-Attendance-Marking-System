import { handler } from "@/lib/http";
import { requireDevice } from "@/lib/device-auth";
import { myModules } from "@/server/student-app";

export const GET = handler(async (req) => myModules(await requireDevice(req)));
