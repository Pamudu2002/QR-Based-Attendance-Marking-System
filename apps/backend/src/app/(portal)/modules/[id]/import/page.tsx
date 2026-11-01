import { moduleShortName } from "@/lib/identity";
import { loadModule } from "../load";
import { CsvImport } from "./CsvImport";

export const metadata = { title: "Import students" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mod } = await loadModule(id);
  return <CsvImport moduleId={id} moduleShort={moduleShortName(mod)} />;
}
