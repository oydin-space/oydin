"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { PRIMARY, SECONDARY, isActive } from "./nav";
import { useCoreT } from "./use-core-t";

const ENTRIES = [...PRIMARY, ...SECONDARY];

/** Заголовок вкладки «Раздел · Oydin» на языке интерфейса для страниц /app/*. */
export function DocumentTitle() {
  const t = useCoreT();
  const pathname = usePathname();
  const entry = ENTRIES.find((e) => isActive(pathname, e.href));
  const title = entry ? `${t(entry.label)} · Oydin` : "Oydin";
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
