"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type PickerLocale = "ru" | "uz" | "en";

const ORDER: PickerLocale[] = ["uz", "ru", "en"];
const NAMES: Record<PickerLocale, string> = { ru: "Русский", uz: "Oʻzbekcha", en: "English" };

export interface LanguagePickerProps {
  value: PickerLocale;
  onChange: (locale: PickerLocale) => void;
  /** pill — три флага в ряд (шапки); menu — список «флаг + название» (настройки). */
  variant?: "pill" | "menu";
  className?: string;
  label?: string;
}

/** Флаг 20×15, рисуется инлайн-SVG; скругление — через clipPath. */
function Flag({ locale }: { locale: PickerLocale }) {
  const clip = useId();
  return (
    <svg width={20} height={15} viewBox="0 0 20 15" aria-hidden="true" focusable="false" className="shrink-0 rounded-[3px]" shapeRendering="geometricPrecision">
      <clipPath id={clip}><rect width="20" height="15" rx="3" /></clipPath>
      <g clipPath={`url(#${clip})`}>
        {locale === "ru" && (
          <>
            <rect width="20" height="5" fill="#fff" />
            <rect y="5" width="20" height="5" fill="#0039A6" />
            <rect y="10" width="20" height="5" fill="#D52B1E" />
          </>
        )}
        {locale === "uz" && (
          <>
            <rect width="20" height="5" fill="#0099B5" />
            <rect y="5" width="20" height="5" fill="#fff" />
            <rect y="10" width="20" height="5" fill="#1EB53A" />
            <rect y="4.6" width="20" height=".6" fill="#CE1126" />
            <rect y="9.8" width="20" height=".6" fill="#CE1126" />
            <path d="M3.9 .9a2 2 0 1 0 0 3.2 1.6 1.6 0 1 1 0-3.2z" fill="#fff" />
            <g fill="#fff">
              <circle cx="6.6" cy="1.6" r=".42" />
              <circle cx="8.2" cy="1.6" r=".42" />
              <circle cx="9.8" cy="1.6" r=".42" />
              <circle cx="7.4" cy="3" r=".42" />
              <circle cx="9" cy="3" r=".42" />
            </g>
          </>
        )}
        {locale === "en" && (
          <>
            <rect width="20" height="15" fill="#012169" />
            <path d="M0 0L20 15M20 0L0 15" stroke="#fff" strokeWidth="3" />
            <path d="M0 0L20 15M20 0L0 15" stroke="#C8102E" strokeWidth="1.2" />
            <path d="M10 0V15M0 7.5H20" stroke="#fff" strokeWidth="5" />
            <path d="M10 0V15M0 7.5H20" stroke="#C8102E" strokeWidth="3" />
          </>
        )}
      </g>
      <rect x=".25" y=".25" width="19.5" height="14.5" rx="2.75" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth=".5" />
    </svg>
  );
}

/** RU / UZ / EN с флагами. Ширина фиксирована, подписи не меняют раскладку. */
export function LanguagePicker({ value, onChange, variant = "pill", className, label = "Language" }: LanguagePickerProps) {
  const move = (dir: 1 | -1) => onChange(ORDER[(ORDER.indexOf(value) + dir + ORDER.length) % ORDER.length]);
  const pill = variant === "pill";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(pill ? "inline-flex shrink-0 gap-0.5 rounded-full bg-muted p-0.5" : "flex w-full flex-col gap-1", className)}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (step) {
          e.preventDefault();
          move(step);
          requestAnimationFrame(() => e.currentTarget.querySelector<HTMLElement>("[aria-checked=true]")?.focus());
        }
      }}
    >
      {ORDER.map((l) => {
        const active = l === value;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={pill ? NAMES[l] : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(l)}
            className={cn(
              "inline-flex min-h-11 items-center gap-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              pill ? "min-w-11 justify-center rounded-full px-2" : "w-full rounded-control px-3 text-left",
              active ? (pill ? "bg-background shadow-sm" : "bg-muted font-semibold") : "hover:bg-muted/60",
            )}
          >
            <Flag locale={l} />
            {pill ? null : <span>{NAMES[l]}</span>}
          </button>
        );
      })}
    </div>
  );
}
