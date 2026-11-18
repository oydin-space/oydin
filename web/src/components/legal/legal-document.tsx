import Link from "next/link";
import { cookies } from "next/headers";
import { LanguageSwitcher } from "@/components/landing/language-switcher";
import { parseLocale } from "@/components/landing/localize";
import { legalContent } from "@/content/legal";
import { legalVersion, type DocumentKind, type LegalLocale } from "@/content/legal/types";

const isLocale = (value: unknown): value is LegalLocale => value === "ru" || value === "uz" || value === "en";

export async function LegalDocument({ kind, searchParams }: { kind: Exclude<DocumentKind, "consent">; searchParams?: Promise<{ lang?: string | string[] }> }) {
  const queryLang = (await searchParams)?.lang;
  // ?lang= wins over the cookie so links from the consent notice open in the language the user saw.
  const locale = isLocale(queryLang) ? queryLang : parseLocale((await cookies()).get("oydin_lang")?.value);
  const copy = legalContent[locale];
  const sections = Object.entries(copy[kind]);
  return (
    <main lang={locale} className="mx-auto w-full max-w-3xl break-words px-page py-8 pb-24 text-foreground sm:px-page-lg">
      <nav aria-label="Oydin" className="mb-8 flex flex-wrap gap-4 text-small">
        <Link href="/" className="min-target focus-ring inline-flex items-center underline">Oydin</Link>
        {(["privacy", "terms"] as const).map((doc) => <Link key={doc} href={`/${doc}?lang=${locale}`} aria-current={doc === kind ? "page" : undefined} className="min-target focus-ring inline-flex items-center underline">{copy.titles[doc]}</Link>)}
      </nav>
      <h1 className="text-page font-semibold">{copy.titles[kind]}</h1>
      <p className="mt-3 text-small text-muted-foreground">{copy.updated}: <time dateTime={legalVersion}>{legalVersion}</time></p>
      <p className="mt-6 rounded-card border border-border bg-butter p-4 text-small text-butter-ink">{copy.draft}</p>
      <p className="mt-4 text-small text-muted-foreground">{copy.precedence}</p>
      <nav aria-label={copy.contents} className="my-8 rounded-card border border-border bg-card p-4">
        <h2 className="font-semibold">{copy.contents}</h2>
        <ol className="mt-2 list-decimal pl-6">
          {sections.map(([id, section]) => <li key={id}><a href={`#${id}`} className="min-target focus-ring inline-flex items-center py-2 underline">{section.title}</a></li>)}
        </ol>
      </nav>
      <article className="space-y-8 text-body leading-relaxed">
        {sections.map(([id, section]) => <section key={id} id={id} className="scroll-mt-6">
          <h2 className="mb-3 text-title font-semibold"><a href={`#${id}`} className="focus-ring">{section.title}</a></h2>
          <div className="space-y-3">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        </section>)}
      </article>
      <LanguageSwitcher locale={locale} />
    </main>
  );
}
