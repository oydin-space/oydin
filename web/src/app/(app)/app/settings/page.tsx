import { SectionGate } from "@/components/settings/section-gate";
import { ProfileSection } from "@/components/settings/profile-section";


export default function Page() {
  return (
    <SectionGate id="profile">
      <ProfileSection />
    </SectionGate>
  );
}
