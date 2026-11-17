"use client";

import { useCallback, useEffect, useState } from "react";

interface State<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

/** Загрузка с сохранением исходной ошибки (нужен её статус: 403/404). `load` должен быть стабильной ссылкой. */
export function useResource<T>(load: () => Promise<T>, enabled = true) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: enabled });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error: unknown) => live && setState({ data: null, error, loading: false }),
    );
    return () => {
      live = false;
    };
  }, [load, enabled, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setTick((n) => n + 1);
  }, []);
  const setData = useCallback((data: T) => setState({ data, error: null, loading: false }), []);
  return { ...state, reload, setData };
}
