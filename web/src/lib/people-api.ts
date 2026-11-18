import { api, post } from "./api";

export const KINDS = ["staff", "contractor", "buyer", "partner"] as const;
export const PAY_TYPES = ["monthly", "hourly", "per_task", "percent", "none"] as const;
export const CURRENCIES = ["UZS", "USD", "RUB", "EUR"] as const;

export type PersonKind = (typeof KINDS)[number];
export type PayType = (typeof PAY_TYPES)[number];
export type PersonCurrency = (typeof CURRENCIES)[number];

export interface Person {
  id: number;
  name: string;
  kind: PersonKind;
  pay_type: PayType;
  pay_amount: string | null;
  currency: PersonCurrency;
  location_id: number | null;
  role_title: string;
  started_on: string | null;
  ended_on: string | null;
  note: string;
}
export type PersonInput = Omit<Person, "id">;
/** Черновик от ИИ-чата: только проверенные поля, остальное добирается значениями по умолчанию при подтверждении. */
export type PersonDraft = Partial<PersonInput> & { name: string };

export const personFromDraft = (d: PersonDraft): PersonInput => ({
  kind: "staff",
  pay_type: "none",
  pay_amount: null,
  currency: "UZS",
  location_id: null,
  role_title: "",
  started_on: null,
  ended_on: null,
  note: "",
  ...d,
});

export interface PeopleLocation {
  id: number;
  name: string;
  address: string;
}
export type LocationInput = Omit<PeopleLocation, "id">;

export interface PeopleSummary {
  headcount_by_kind: Partial<Record<PersonKind, number>>;
  monthly_cost_uzs: string;
  by_location: { location_id: number | null; name: string; headcount: number; monthly_cost_uzs: string }[];
  turnover_month: { joined: number; left: number };
}

const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const remove = (path: string) => api<void>(path, { method: "DELETE" });

export const peopleApi = {
  list: () => api<{ people: Person[] }>("/people/").then((r) => r.people),
  create: (body: PersonInput) => post<Person>("/people/", body),
  update: (id: number, body: Partial<PersonInput>) => patch<Person>(`/people/${id}/`, body),
  remove: (id: number) => remove(`/people/${id}/`),
  summary: () => api<PeopleSummary>("/people/summary/"),
  locations: () => api<{ locations: PeopleLocation[] }>("/people/locations/").then((r) => r.locations),
  createLocation: (body: LocationInput) => post<PeopleLocation>("/people/locations/", body),
  updateLocation: (id: number, body: LocationInput) => patch<PeopleLocation>(`/people/locations/${id}/`, body),
  removeLocation: (id: number) => remove(`/people/locations/${id}/`),
};
