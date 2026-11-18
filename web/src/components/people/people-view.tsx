"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Button, EmptyState, ErrorState, PAGE_WIDTH, PageHeader, SkeletonList } from "@/components/ui";
import { useT } from "@/i18n";
import type { Person } from "@/lib/people-api";
import { LocationsManager } from "./locations-manager";
import { PeopleFilters, type KindFilter } from "./people-filters";
import { PeopleSummary } from "./people-summary";
import { PersonList } from "./person-list";
import { PersonSheet } from "./person-sheet";
import { usePeople } from "./use-people";

type Panel = { person: Person | null } | null;

export function PeopleView() {
  const t = useT();
  const { user } = useSession();
  const allowed = user?.role === "owner" || user?.role === "accountant";
  const { data, failed, reload, retry } = usePeople();
  const [kind, setKind] = useState<KindFilter>("all");
  const [location, setLocation] = useState("all");
  const [panel, setPanel] = useState<Panel>(null);

  if (!allowed) return <EmptyState title={t("people.forbidden.title")} hint={t("people.forbidden.hint")} />;

  const visible = data?.people.filter((p) => (kind === "all" || p.kind === kind) && (location === "all" || String(p.location_id) === location)) ?? [];

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-5`}>
      <PageHeader title={t("people.title")} hint={t("people.hint")} actions={<Button icon={Plus} onClick={() => setPanel({ person: null })}>{t("people.add")}</Button>} />
      {failed ? (
        <ErrorState message={t("people.loadError")} onRetry={retry} />
      ) : !data ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <PeopleSummary summary={data.summary} />
          {data.people.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <Image src="/brand/empty.png" alt="" width={160} height={160} className="h-auto w-40" />
              <EmptyState title={t("people.empty.title")} hint={t("people.empty.hint")} action={<Button icon={Plus} onClick={() => setPanel({ person: null })}>{t("people.add")}</Button>} className="w-full" />
            </div>
          ) : (
            <>
              <PeopleFilters kind={kind} onKind={setKind} location={location} onLocation={setLocation} locations={data.locations} />
              {visible.length === 0 ? (
                <EmptyState title={t("people.emptyFiltered")} />
              ) : (
                <PersonList people={visible} locations={data.locations} onOpen={(person) => setPanel({ person })} />
              )}
            </>
          )}
          <LocationsManager locations={data.locations} summary={data.summary} onChanged={reload} />
          {panel ? (
            <PersonSheet
              key={panel.person?.id ?? "new"}
              person={panel.person}
              defaultKind={kind === "all" ? "staff" : kind}
              locations={data.locations}
              onClose={() => setPanel(null)}
              onChanged={reload}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
