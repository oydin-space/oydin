import { SectionGate } from "@/components/settings/section-gate";
import { NotificationsSection } from "@/components/settings/notifications-section";


export default function Page() {
  return (
    <SectionGate id="notifications">
      <NotificationsSection />
    </SectionGate>
  );
}
