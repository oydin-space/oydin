"use client";

import { Select } from "@/components/ui";
import type { Segment } from "@/lib/auth-api";

export const segmentStrings = {
  label: "Чем занимается бизнес",
  placeholder: "Выберите сферу",
  options: {
    textile_print: "Печать на текстиле",
    retail: "Розница",
    horeca: "HoReCa (кафе, рестораны)",
    marketplace_seller: "Продавец на маркетплейсах",
    services: "Услуги",
  } satisfies Record<Segment, string>,
};

export function SegmentSelect({ value, onValueChange, error }: { value: Segment | undefined; onValueChange: (s: Segment) => void; error?: string }) {
  const options = (Object.keys(segmentStrings.options) as Segment[]).map((v) => ({ value: v, label: segmentStrings.options[v] }));
  return <Select label={segmentStrings.label} placeholder={segmentStrings.placeholder} options={options} value={value} onValueChange={(v) => onValueChange(v as Segment)} error={error} required />;
}
