"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface Settled<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/** GET-ресурс: loading / error / data. path=null — не грузим. Смена path или reload() перезапрашивает. */
export function useApi<T>(path: string | null): Resource<T> {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const key = `${path}#${tick}`;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => !cancelled && setSettled({ key, data, error: null }))
      .catch((e: Error) => !cancelled && setSettled({ key, data: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const done = settled?.key === key;
  return { data: settled?.data ?? null, loading: !!path && !done, error: done ? settled.error : null, reload };
}
