import { notFound } from "next/navigation";
import { requireLecturer } from "@/lib/auth";
import { db } from "@/lib/db";
import { moduleShortName } from "@/lib/identity";
import { formatTime } from "@/lib/time";
import { CheckinProjector } from "./CheckinProjector";

export const metadata = { title: "Check-in QR" };

const MODE_LABEL = { NORMAL: null, EXP_GENUINE: "Genuine run", EXP_RELAY: "Relay run" } as const;

export default async function CheckinProjectorPage({ params }: { params: Promise<{ windowId: string }> }) {
  const { windowId } = await params;
  const lecturer = await requireLecturer();
  const window = await db.checkinWindow.findFirst({
    where: { id: windowId, session: { module: { lecturerId: lecturer.id } } },
    include: { session: { include: { module: true } } },
  });
  if (!window) notFound();
  const { session } = window;
  const mode = MODE_LABEL[window.mode];

  return (
    <CheckinProjector
      windowId={window.id}
      sessionId={session.id}
      badge={`${moduleShortName(session.module)} · ${session.module.name}`}
      lead={`${session.title} · ${formatTime(session.startsAt)} – ${formatTime(session.endsAt)}`}
      intervalSec={window.intervalSec}
      experiment={mode ? `${mode} · T = ${window.intervalSec} s${window.label ? ` · ${window.label}` : ""}` : null}
      initiallyEnded={!!window.endedAt}
    />
  );
}
