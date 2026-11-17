import { SectionGate } from "@/components/settings/section-gate";
import { IntegrationsSection } from "@/components/settings/integrations-section";


export default function Page() {
  return (
    <SectionGate id="integrations">
      <IntegrationsSection />
    </SectionGate>
  );
}
