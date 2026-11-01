import { loadSessionsView } from "../../../sessions/load-sessions";
import { SessionsView } from "../../../sessions/SessionsView";
import { loadModule } from "../load";

export const metadata = { title: "Sessions" };

export default async function ModuleSessionsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { lecturer } = await loadModule(id);
  const { month } = await searchParams;
  const props = await loadSessionsView(lecturer.id, { month, moduleId: id, fixedModule: true });
  return <SessionsView {...props} />;
}
