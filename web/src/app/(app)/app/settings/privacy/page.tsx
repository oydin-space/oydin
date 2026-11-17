import { SectionGate } from "@/components/settings/section-gate";
import { PrivacySection } from "@/components/settings/privacy-section";


export default function Page() {
  return (
    <SectionGate id="privacy">
      <PrivacySection />
    </SectionGate>
  );
}
