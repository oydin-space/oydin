import Link from "next/link";
import { legalContent } from "@/content/legal";
import { legalVersion, type LegalLocale } from "@/content/legal/types";

export interface ConsentValue { terms: boolean; ai: boolean; marketing: boolean }
export const emptyConsent: ConsentValue = { terms: false, ai: false, marketing: false };

const CHOICES = ["terms", "ai", "marketing"] as const;

/** Controlled consent block for the sign-up form. Terms are required; AI and marketing are
 * optional, unchecked by default and never implied by accepting terms. It does not submit or
 * persist anything: send the value to PUT /api/consents/ after sign-in. */
export function ConsentNotice({ locale, value, onChange, disabled = false }: {
  locale: LegalLocale;
  value: ConsentValue;
  onChange: (next: ConsentValue) => void;
  disabled?: boolean;
}) {
  const copy = legalContent[locale];
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
