import { SectionGate } from "@/components/settings/section-gate";
import { DataSection } from "@/components/settings/data-section";


export default function Page() {
  return (
    <SectionGate id="data">
      <DataSection />
    </SectionGate>
  );
}
