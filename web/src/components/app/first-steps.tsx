"use client"

import { FileUp, MessageCircle, PenLine, Wallet } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCoreT } from "@/components/app/use-core-t"
import { Icon, ListGroup, ListRow, Section } from "@/components/ui"

/** Checklist for a business with no accounts or entries yet. */
export function FirstSteps({ onEntry }: { onEntry: () => void }) {
  const t = useCoreT()
  const router = useRouter()
  const steps = [
    { id: "account", icon: Wallet, go: () => router.push("/app/settings") },
    { id: "entry", icon: PenLine, go: onEntry },
    { id: "import", icon: FileUp, go: () => router.push("/app/tools") },
    { id: "telegram", icon: MessageCircle, go: () => router.push("/app/settings") },
  ] as const
  return (
    <Section title={t("core.first.title")}>
      <ListGroup footer={t("core.first.hint")}>
        {steps.map((s) => (
          <ListRow key={s.id} leading={<Icon icon={s.icon} />} title={t(`core.first.${s.id}`)} subtitle={t(`core.first.${s.id}Hint`)} onClick={s.go} />
        ))}
      </ListGroup>
    </Section>
  )
}
