"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { isForbidden } from "@/lib/planning-api";
import { translate, useI18n, type Locale } from "@/i18n";
import { EmptyState, SkeletonList, StateView } from "@/components/ui";
import type { plan } from "@/i18n/parts/plan";

type Prefixed = keyof (typeof plan)["ru"];
export type PlanKey = Prefixed extends `plan.${infer K}` ? K : never;
type Params = Record<string, string | number>;

/** t() для ключей `plan.*`: до слияния частей в основной словарь типы Key их ещё не знают, поэтому тонкая обёртка над translate. */
export function usePlanT() {
  const { locale } = useI18n();
  return useCallback((key: PlanKey, params?: Params) => translate(locale as Locale, `plan.${key}` as never, params), [locale]);
}

export function usePlanFormat() {
  const { locale, formatDate } = useI18n();
  return {
    locale,
    date: (iso: string) => formatDate(`${iso}T12:00:00+05:00`, { day: "numeric", month: "short" }),
    dateLong: (iso: string) => formatDate(`${iso}T12:00:00+05:00`, { day: "numeric", month: "long", year: "numeric" }),
  };
}

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  reload: () => void;
}

/** Загрузка через функцию-запрос; перезапрашивается по reload(). */
export function useLoad<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = []): Loaded<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; forbidden: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const ref = useRef(fetcher);
  useEffect(() => {
    ref.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    ref
      .current()
      .then((data) => !cancelled && setState({ data, error: null, forbidden: false }))
      .catch((e: unknown) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : "error", forbidden: isForbidden(e) }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data: state?.data ?? null, loading: state === null, error: state?.error ?? null, forbidden: !!state?.forbidden, reload };
}

/** Единый порядок состояний: загрузка → нет доступа → ошибка с повтором → пусто → данные. */
export function LoadView<T>({ res, isEmpty, empty, skeleton, children }: { res: Loaded<T>; isEmpty?: (d: T) => boolean; empty?: { title: string; hint?: string; action?: React.ReactNode }; skeleton?: React.ReactNode; children: (d: T) => React.ReactNode }) {
  const t = usePlanT();
  if (res.forbidden) return <EmptyState title={t("forbidden.title")} hint={t("forbidden.hint")} />;
  const status = res.loading ? "loading" : res.error || res.data === null ? "error" : isEmpty?.(res.data) ? "empty" : "ready";
  return (
    <StateView status={status} error={res.error ?? ""} onRetry={res.reload} empty={empty} skeleton={skeleton ?? <SkeletonList rows={3} />}>
      {res.data !== null ? children(res.data) : null}
    </StateView>
  );
}

/** Понятный текст ошибки на языке интерфейса: известные коды и статусы, иначе общий. */
export function useErrorText() {
  const t = usePlanT();
  return useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.status === 403) return t("err.forbidden");
        if (e.status === 404) return t("err.notFound");
        if (e.status === 409) return e.message === "already_closed" ? t("err.alreadyClosed") : t("err.conflict");
        if (e.status === 503) return t("err.noRate");
        if (e.status === 400) return t("err.invalid");
      }
      return t("err.generic");
    },
    [t],
  );
}

/** Выполняет запись: busy-флаг, тост успеха или понятной ошибки. Возвращает true при успехе. */
export function useAction() {
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await fn();
        if (success) toast.success(success);
        return true;
      } catch (e) {
        toast.error(errorText(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [errorText],
  );
  return { busy, run };
}
