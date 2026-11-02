import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { endWindow } from "@/server/checkin";

export const POST = handler<{ id: string }>(async (req, { params }) => endWindow(await requireLecturerId(req), params.id));
