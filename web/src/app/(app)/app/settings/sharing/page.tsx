import { SectionGate } from "@/components/settings/section-gate";
import { SharingSection } from "@/components/settings/sharing-section";


export default function Page() {
  return (
    <SectionGate id="sharing">
      <SharingSection />
    </SectionGate>
  );
}
