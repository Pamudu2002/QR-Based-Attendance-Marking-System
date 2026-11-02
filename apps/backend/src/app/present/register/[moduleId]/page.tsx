import { moduleShortName } from "@/lib/identity";
import { loadModule } from "../../../(portal)/modules/[id]/load";
import { RegisterProjector } from "./RegisterProjector";

export const metadata = { title: "Registration QR" };

export default async function RegisterProjectorPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const { mod } = await loadModule(moduleId);
  return (
    <RegisterProjector
      moduleId={mod.id}
      shortName={moduleShortName(mod)}
      name={mod.name}
      initialOpen={mod.registrationOpen}
    />
  );
}
