"use client";

import Link from "next/link";
import type { Ref } from "react";
import { useAT } from "@/components/auth/use-at";
import { Checkbox, ChoiceControl } from "@/components/ui";
import { legalContent } from "@/content/legal";
import { legalVersion, type LegalLocale } from "@/content/legal/types";

export interface ConsentValue { terms: boolean; ai: boolean; marketing: boolean }
export const emptyConsent: ConsentValue = { terms: false, ai: false, marketing: false };

const CHOICES = ["terms", "ai", "marketing"] as const;

/** Controlled consent block for the sign-up form. Terms are required; AI and marketing are
 * optional, unchecked by default and never implied by accepting terms. It does not submit or
 * persist anything: send the value to PUT /api/consents/ after sign-in.
 * `compact` renders one terms line plus a collapsed disclosure with the separate optional toggles;
 * `invalid` highlights the terms checkbox, `termsRef` lets the parent scroll/focus it. */
export function ConsentNotice({ locale, value, onChange, disabled = false, compact = false, invalid = false, termsRef }: {
  locale: LegalLocale;
  value: ConsentValue;
  onChange: (next: ConsentValue) => void;
  disabled?: boolean;
  compact?: boolean;
  invalid?: boolean;
  termsRef?: Ref<HTMLButtonElement>;
}) {
  const copy = legalContent[locale];
  const { t } = useAT();
  if (compact) {
    const linkClass = "focus-ring -my-3 inline-block py-3 underline underline-offset-2";
    return (
      <div lang={locale} className="space-y-1 text-small">
        <input type="hidden" name="legal_version" value={legalVersion} />
        <input type="hidden" name="legal_locale" value={locale} />
        <div className="flex min-h-11 items-center gap-3 py-1">
          <Checkbox
            ref={termsRef}
            id="consent-terms"
            name="consent_terms"
            checked={value.terms}
            onCheckedChange={(v) => onChange({ ...value, terms: v === true })}
            disabled={disabled}
            required
            aria-invalid={invalid || undefined}
            className="aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/40"
          />
          <label htmlFor="consent-terms" className="flex-1 py-1 text-small">
            {t("auth.consent.accept")}{" "}
            <Link href={`/terms?lang=${locale}`} target="_blank" rel="noopener noreferrer" className={linkClass}>{copy.titles.terms}</Link>{" "}
            {t("auth.consent.and")}{" "}
            <Link href={`/privacy?lang=${locale}`} target="_blank" rel="noopener noreferrer" className={linkClass}>{copy.titles.privacy}</Link>
          </label>
        </div>
        <details className="group rounded-card border border-border px-3">
          <summary className="focus-ring min-h-11 cursor-pointer list-none py-3 font-semibold text-muted-foreground group-open:text-foreground">
            {t("auth.consent.optional")}
          </summary>
          <div className="pb-2">
            {(["ai", "marketing"] as const).map((choice) => (
              <ChoiceControl
                key={choice}
                kind="switch"
                label={copy.consent[choice].title}
                description={copy.optional}
                checked={value[choice]}
                onCheckedChange={(checked) => onChange({ ...value, [choice]: checked })}
                disabled={disabled}
              />
            ))}
          </div>
        </details>
      </div>
    );
  }
  return (
    <fieldset disabled={disabled} lang={locale} className="min-w-0 space-y-4 rounded-card border border-border bg-card p-4 text-small">
      <legend className="px-2 text-title font-semibold">{copy.titles.consent}</legend>
      <input type="hidden" name="legal_version" value={legalVersion} />
      <input type="hidden" name="legal_locale" value={locale} />
      <p className="text-muted-foreground">{copy.draft}</p>
      <div className="flex flex-wrap gap-4">
        <Link href={`/terms?lang=${locale}`} target="_blank" rel="noopener noreferrer" className="min-target focus-ring inline-flex items-center underline">{copy.titles.terms}</Link>
        <Link href={`/privacy?lang=${locale}`} target="_blank" rel="noopener noreferrer" className="min-target focus-ring inline-flex items-center underline">{copy.titles.privacy}</Link>
      </div>
      {CHOICES.map((choice) => <label key={choice} className="flex min-h-target cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          name={`consent_${choice}`}
          checked={value[choice]}
          onChange={(event) => onChange({ ...value, [choice]: event.target.checked })}
          required={choice === "terms"}
          className="focus-ring mt-1 size-5 shrink-0 accent-primary"
        />
        <span className="min-w-0 space-y-2">
          <span className="block font-semibold">{copy.consent[choice].title}</span>
          {choice !== "terms" && <span className="block text-muted-foreground">{copy.optional}</span>}
          {copy.consent[choice].paragraphs.map((paragraph) => <span key={paragraph} className="block break-words">{paragraph}</span>)}
        </span>
      </label>)}
      <div className="space-y-2 text-muted-foreground">
        <p className="font-semibold">{copy.consent.withdrawal.title}</p>
        {copy.consent.withdrawal.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <p>{copy.precedence}</p>
      </div>
    </fieldset>
  );
}
