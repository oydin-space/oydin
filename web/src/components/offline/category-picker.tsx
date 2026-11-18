"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { Chip, Icon, Input } from "@/components/ui";
import { categoryName } from "@/components/chat/category-name";
import { useLocale } from "@/i18n";
import { api } from "@/lib/api";
import { categoryOptions, existingCategories } from "@/lib/offline/labels";
import { useOfflineT } from "./use-offline-t";

interface Props {
  label: string;
  direction: "in" | "out";
  /** Каноническое имя категории (то, что уйдёт на сервер) или пустая строка. */
  value: string;
  onChange: (canonical: string) => void;
  error?: string;
  required?: boolean;
}

/**
 * Категория: поле поиска и чипы. Сначала существующие категории бизнеса (по частоте), затем стандартные;
 * при вводе остаются подходящие («Аренда зала» → «Аренда»), а новое имя предлагается последним.
 */
export function CategoryPicker({ label, direction, value, onChange, error, required }: Props) {
  const t = useOfflineT();
  const [locale] = useLocale();
  const localize = useCallback((n: string) => categoryName(n, locale), [locale]);
  const [recent, setRecent] = useState<{ category: string; direction: string }[]>([]);
  const [text, setText] = useState(value);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    api<{ items: { category: string; direction: string }[] }>("/transactions/?limit=200")
      .then((r) => live && setRecent(r.items))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const existing = useMemo(() => existingCategories(recent, direction), [recent, direction]);
  const all = useMemo(() => categoryOptions(direction, existing, "", t, localize), [direction, existing, t, localize]);
  const matches = useMemo(() => categoryOptions(direction, existing, query, t, localize).slice(0, 8), [direction, existing, query, t, localize]);
  const canonical = (s: string) => {
    const n = s.trim().toLocaleLowerCase();
    return all.find((o) => o.label.toLocaleLowerCase() === n || o.value.toLocaleLowerCase() === n)?.value ?? s.trim();
  };
  const typed = query.trim();
  const isNew = typed !== "" && !all.some((o) => o.value === canonical(typed));

  // Внешнее значение (голос, смена направления) подменяет текст поля.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (canonical(text) !== value) {
      setText(all.find((o) => o.value === value)?.label ?? value);
      setQuery("");
    }
  }

  const emit = (next: string) => {
    setSeen(next);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        label={label}
        placeholder={t("offline.catPlaceholder")}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setQuery(e.target.value);
          // Неточный ввод по умолчанию сопоставляется с лучшей существующей категорией; новую создаёт чип «Новая».
          const exact = canonical(e.target.value);
          const best = categoryOptions(direction, existing, e.target.value, t, localize)[0];
          emit(all.some((o) => o.value === exact) || !best ? exact : best.value);
        }}
        error={error}
        required={required}
        autoComplete="off"
        leading={<Icon icon={Tag} size={16} />}
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {matches.map((o) => (
          <Chip
            key={o.value}
            selected={value === o.value}
            onSelect={() => {
              setText(o.label);
              emit(o.value);
            }}
          >
            {o.label}
          </Chip>
        ))}
        {isNew ? (
          <Chip selected={value === typed} onSelect={() => emit(typed)}>
            {t("offline.catNew", { name: typed })}
          </Chip>
        ) : null}
      </div>
    </div>
  );
}
