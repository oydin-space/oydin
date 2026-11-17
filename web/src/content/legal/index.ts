import { en } from "./en";
import { ru } from "./ru";
import { uz } from "./uz";
import type { LegalBundle, LegalLocale } from "./types";

export const legalContent: Record<LegalLocale, LegalBundle> = { ru, uz, en };
export { legalVersion } from "./types";
export type { LegalLocale } from "./types";
