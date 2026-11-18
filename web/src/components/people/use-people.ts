"use client";

import { useCallback, useEffect, useState } from "react";
import { peopleApi, type PeopleLocation, type PeopleSummary, type Person } from "@/lib/people-api";

export interface PeopleData {
  people: Person[];
  locations: PeopleLocation[];
  summary: PeopleSummary;
}

/** One load of the whole screen; `reload` refreshes silently after a mutation. */
export function usePeople() {
  const [data, setData] = useState<PeopleData | null>(null);
  const [failed, setFailed] = useState(false);

  const fetchAll = useCallback(async (): Promise<PeopleData> => {
    const [people, locations, summary] = await Promise.all([peopleApi.list(), peopleApi.locations(), peopleApi.summary()]);
    return { people, locations, summary };
  }, []);

  const reload = useCallback(async () => {
    try {
      setData(await fetchAll());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [fetchAll]);

  const retry = useCallback(() => {
    setFailed(false);
    setData(null);
    void reload();
  }, [reload]);

  useEffect(() => {
    let off = false;
    fetchAll().then(
      (d) => !off && setData(d),
      () => !off && setFailed(true),
    );
    return () => {
      off = true;
    };
  }, [fetchAll]);

  return { data, failed, reload, retry };
}
