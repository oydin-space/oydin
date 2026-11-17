import { SectionGate } from "@/components/settings/section-gate";
import { DeveloperSection } from "@/components/settings/developer-section";


export default function Page() {
  return (
    <SectionGate id="developer">
      <DeveloperSection />
    </SectionGate>
  );
}
