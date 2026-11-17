import { SectionGate } from "@/components/settings/section-gate";
import { AccountsSection } from "@/components/settings/accounts-section";


export default function Page() {
  return (
    <SectionGate id="accounts">
      <AccountsSection />
    </SectionGate>
  );
}
