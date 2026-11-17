import { Suspense } from "react";
import { PlanView } from "@/components/planning/plan-view";


export default function PlanPage() {
  return (
    <Suspense>
      <PlanView />
    </Suspense>
  );
}
