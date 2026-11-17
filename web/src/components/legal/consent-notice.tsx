import Link from "next/link";
import { legalContent } from "@/content/legal";
import { legalVersion, type LegalLocale } from "@/content/legal/types";

/** Place inside the sign-up form. Persist each FormData choice separately;
 * unchecked fields are absent, never implied by terms acceptance.
 * This block does not submit, persist consent, or enable AI by itself.
 */
export function ConsentNotice({ locale, disabled = false }: { locale: LegalLocale; disabled?: boolean }) {
  const copy = legalContent[locale];
  return (
    <fieldset disabled={disabled} lang={locale} className="min-w-0 space-y-4 rounded-card border border-border bg-card p-4 text-small">
      <legend className="px-2 text-title font-semibold">{copy.titles.consent}</legend>
      <input type="hidden" name="legal_version" value={legalVersion} />
      <input type="hidden" name="legal_locale" value={locale} />
      <p className="text-muted-foreground">{copy.draft}</p>
      <div className="flex flex-wrap gap-4">
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="min-target focus-ring inline-flex items-center underline">{copy.titles.terms}</Link>
        <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="min-target focus-ring inline-flex items-center underline">{copy.titles.privacy}</Link>
      </div>
      {(["service", "ai", "partners", "benchmarks", "emails"] as const).map((choice) => <label key={choice} className="flex min-h-target cursor-pointer items-start gap-3 py-2">
        <input type="checkbox" name={`consent_${choice}`} value="yes" required={choice === "service"} className="focus-ring mt-1 size-5 shrink-0 accent-primary" />
        <span className="min-w-0 space-y-2">
          <span className="block font-semibold">{copy.consent[choice].title}</span>
          {choice !== "service" && <span className="block text-muted-foreground">{copy.optional}</span>}
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
