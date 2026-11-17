"use client";

import { LOCALES, LOCALE_LABELS, useLocale, type Locale } from "@/i18n";
import { SegmentedControl } from "./segmented-control";

export interface LanguageSwitcherProps {
  className?: string;
  /** Вызывается после смены языка (например, чтобы перечитать серверный контент). */
  onChange?: (locale: Locale) => void;
}

/** RU / UZ / EN. Язык сохраняется в cookie и применяется без перезагрузки. */
export function LanguageSwitcher({ className, onChange }: LanguageSwitcherProps) {
  const [locale, setLocale] = useLocale();
  return (
    <SegmentedControl<Locale>
      label="Language"
      className={className}
      options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
      value={locale}
      onValueChange={(next) => {
        setLocale(next);
        onChange?.(next);
      }}
    />
  );
}
