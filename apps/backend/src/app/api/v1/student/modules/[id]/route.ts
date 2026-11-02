import { handler } from "@/lib/http";
import { requireDevice } from "@/lib/device-auth";
import { myModule } from "@/server/student-app";

export const GET = handler<{ id: string }>(async (req, { params }) => myModule(await requireDevice(req), params.id));
