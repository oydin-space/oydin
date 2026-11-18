"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Button, EmptyState, ErrorState, PAGE_WIDTH, PageHeader, SkeletonList, Text } from "@/components/ui";
import { useT } from "@/i18n";
import type { Person } from "@/lib/people-api";
import { PersonList } from "./person-list";
import { PersonSheet } from "./person-sheet";
import { usePeople } from "./use-people";

type Panel = { person: Person | null } | null;

export function PeopleView() {
  const t = useT();
  const { user } = useSession();
  const allowed = user?.role === "owner" || user?.role === "accountant";
  const { people, failed, reload, retry } = usePeople();
  const [panel, setPanel] = useState<Panel>(null);

  if (!allowed) return <EmptyState title={t("people.forbidden.title")} hint={t("people.forbidden.hint")} />;

  // Only paid staff and contractors affect the forecast.
  const paid = people?.filter((p) => (p.kind === "staff" || p.kind === "contractor") && p.pay_type !== "none") ?? [];

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-5`}>
      <PageHeader title={t("people.title")} hint={t("people.hint")} actions={<Button icon={Plus} onClick={() => setPanel({ person: null })}>{t("people.add")}</Button>} />
      <Text variant="secondary" tone="muted">
        {t("people.obligationsNote")}{" "}
        <Link href="/app/calendar" className="font-medium text-foreground underline underline-offset-2">
          {t("people.obligationsLink")}
        </Link>
      </Text>
      {failed ? (
        <ErrorState message={t("people.loadError")} onRetry={retry} />
      ) : !people ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {paid.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <Image src="/brand/empty.png" alt="" width={160} height={160} className="h-auto w-40" />
              <EmptyState title={t("people.empty.title")} hint={t("people.empty.hint")} action={<Button icon={Plus} onClick={() => setPanel({ person: null })}>{t("people.add")}</Button>} className="w-full" />
            </div>
          ) : (
            <PersonList people={paid} onOpen={(person) => setPanel({ person })} />
          )}
          {panel ? <PersonSheet key={panel.person?.id ?? "new"} person={panel.person} onClose={() => setPanel(null)} onChanged={reload} /> : null}
        </>
      )}
    </div>
  );
}
