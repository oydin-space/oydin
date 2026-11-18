"use client";

import { useCallback, useEffect, useState } from "react";
import { peopleApi, type Person } from "@/lib/people-api";

/** One load of the list; `reload` refreshes silently after a mutation. */
export function usePeople() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setPeople(await peopleApi.list());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setPeople(null);
    void reload();
  }, [reload]);

  useEffect(() => {
    let off = false;
    peopleApi.list().then(
      (d) => !off && setPeople(d),
      () => !off && setFailed(true),
    );
    return () => {
      off = true;
    };
  }, []);

  return { people, failed, reload, retry };
}
