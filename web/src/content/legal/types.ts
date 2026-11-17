export type LegalLocale = "ru" | "uz" | "en";
export type DocumentKind = "privacy" | "terms" | "consent";
export const legalVersion = "2026-11-18";
export type PrivacySection = "operator" | "data" | "purposes" | "ai" | "hosting" | "sharing" | "telegram" | "cookies" | "retention" | "rights" | "security" | "demo" | "children" | "changes";
export type TermsSection = "operator" | "scope" | "accuracy" | "tax" | "access" | "use" | "plans" | "data" | "availability" | "liability" | "termination" | "law" | "changes";
export type ConsentSection = "terms" | "ai" | "partners" | "marketing" | "withdrawal";
export interface Section { title: string; paragraphs: readonly string[] }
export interface LegalBundle {
  titles: Record<DocumentKind, string>;
  updated: string;
  contents: string;
  draft: string;
  precedence: string;
  optional: string;
  privacy: Record<PrivacySection, Section>;
  terms: Record<TermsSection, Section>;
  consent: Record<ConsentSection, Section>;
}
