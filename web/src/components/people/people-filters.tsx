"use client";

import { FilterBar } from "@/components/ui";
import { useT } from "@/i18n";
import { KINDS, type PeopleLocation, type PersonKind } from "@/lib/people-api";

export type KindFilter = PersonKind | "all";

export function PeopleFilters({
  kind,
  onKind,
  location,
  onLocation,
  locations,
}: {
  kind: KindFilter;
  onKind: (v: KindFilter) => void;
  location: string;
  onLocation: (v: string) => void;
  locations: PeopleLocation[];
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <FilterBar
        label={t("people.filter.kind")}
        value={kind}
        onValueChange={(v) => onKind(v as KindFilter)}
        options={[{ value: "all", label: t("people.filter.all") }, ...KINDS.map((k) => ({ value: k, label: t(`people.kind.${k}`) }))]}
      />
      {locations.length > 0 ? (
        <FilterBar
          label={t("people.filter.location")}
          value={location}
          onValueChange={onLocation}
          options={[{ value: "all", label: t("people.filter.allLocations") }, ...locations.map((l) => ({ value: String(l.id), label: l.name }))]}
        />
      ) : null}
    </div>
  );
}
