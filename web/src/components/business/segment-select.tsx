"use client";

import { useAT, type AKey } from "@/components/auth/use-at";
import { Select } from "@/components/ui";
import type { Segment } from "@/lib/auth-api";

const SEGMENTS: Segment[] = ["textile_print", "retail", "horeca", "marketplace_seller", "services"];

export function SegmentSelect({ value, onValueChange, error }: { value: Segment | undefined; onValueChange: (s: Segment) => void; error?: string }) {
  const { t } = useAT();
  const options = SEGMENTS.map((v) => ({ value: v, label: t(`auth.segment.${v}` satisfies AKey) }));
  return <Select label={t("auth.segment.label")} placeholder={t("auth.segment.placeholder")} options={options} value={value} onValueChange={(v) => onValueChange(v as Segment)} error={error} required />;
}
