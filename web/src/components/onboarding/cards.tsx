"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, Copy, Download, Home, ListOrdered, MessageCircle, Mic, Search, Send, Share, Upload } from "lucide-react";
import { useLocale, useT, type Key, type TFunction } from "@/i18n";
import { ApiError } from "@/lib/api";
import { commitImport, MAX_UPLOAD_BYTES, uploadImport, type ImportJob } from "@/lib/settings-api";
import { Badge, Button, Card, Chip, Input, LanguagePicker, PastelCard, SkeletonText, StatusBanner, Text } from "@/components/ui";
import {
  CHANNELS,
  createInvite,
  getMemory,
  GOALS,
  LEGAL_FORMS,
  lookupCompany,
  PAINS,
  ACTIVITIES,
  ACTIVITY_OTHER_MAX,
  TEAM,
  type CompanyCandidate,
  type Invite,
  type LookupResult,
  type MemoryContext,
  type OnboardingState,
  type Plan,
} from "./api";
import { useInstall } from "./use-install";

export type Submit = (value?: Record<string, unknown>) => Promise<void>;

/** Код ошибки бэкенда → текст; неизвестные коды → общий текст. */
export function errorText(t: TFunction, err: unknown): string {
  const code = err instanceof ApiError ? err.message : "generic";
  const key = `onboarding.error.${code}` as Key;
  const text = t(key);
  return text === key ? t("onboarding.error.generic") : text;
}

function useAction() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  max = 1,
  labelOf,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  max?: number;
  labelOf: (v: T) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <Text as="legend" variant="secondary" tone="muted" className="mb-2">
        {label}
      </Text>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value.includes(o);
          return (
            <Chip
              key={o}
              selected={selected}
              onSelect={() =>
                onChange(selected ? value.filter((v) => v !== o) : max === 1 ? [o] : value.length < max ? [...value, o] : value)
              }
            >
              {labelOf(o)}
            </Chip>
          );
        })}
      </div>
    </fieldset>
  );
}

function Actions({ children, error }: { children: React.ReactNode; error?: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      {error ? <StatusBanner kind="error" title={error} /> : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SkipButton({ onSkip, busy }: { onSkip?: () => Promise<void>; busy: boolean }) {
  const t = useT();
  if (!onSkip) return null;
  return (
    <Button variant="ghost" disabled={busy} onClick={() => void onSkip()}>
      {t("onboarding.skip")}
    </Button>
  );
}

// ─── Акт 1 ────────────────────────────────────────────────────────────────────────────────────────

export function ConsentCard({ onSubmit }: { onSubmit: Submit }) {
  const t = useT();
  const [locale, setLocale] = useLocale();
  const { busy, error, run } = useAction();
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2">
        <Text variant="secondary" tone="muted">
          {t("onboarding.consent.language")}
        </Text>
        <LanguagePicker value={locale} onChange={setLocale} label={t("onboarding.consent.language")} />
      </div>
      <Text variant="secondary">{t("onboarding.consent.body")}</Text>
      <Actions error={error}>
        <Button block loading={busy} onClick={() => run(() => onSubmit({ ai: true, language: locale }))}>
          {t("onboarding.consent.agree")}
        </Button>
        <Button block variant="secondary" disabled={busy} onClick={() => run(() => onSubmit({ ai: false, language: locale }))}>
          {t("onboarding.consent.noAi")}
        </Button>
      </Actions>
    </Card>
  );
}

export function NameCard({ state, onSubmit }: { state: OnboardingState; onSubmit: Submit }) {
  const t = useT();
  const [first, setFirst] = useState(state.prefill?.first_name ?? "");
  const [last, setLast] = useState(state.prefill?.last_name ?? "");
  const { busy, error, run } = useAction();
  return (
    <Card>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => onSubmit({ first_name: first, last_name: last }));
        }}
      >
        <Input label={t("onboarding.name.first")} value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" required />
        <Input label={t("onboarding.name.last")} value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
        <Actions error={error}>
          <Button type="submit" block loading={busy} disabled={!first.trim()}>
            {t("onboarding.next")}
          </Button>
        </Actions>
      </form>
    </Card>
  );
}

export function ContactCard({ state, onSubmit, onSkip }: { state: OnboardingState; onSubmit: Submit; onSkip: () => Promise<void> }) {
  const t = useT();
  const p = state.prefill;
  const [phone, setPhone] = useState(p?.phone.replace(/^\+998/, "") ?? "");
  const [telegram, setTelegram] = useState(p?.telegram ?? "");
  const [email, setEmail] = useState(p?.email ?? "");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>(p?.channel ?? "app");
  const { busy, error, run } = useAction();
  return (
    <Card>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => onSubmit({ phone, telegram, email, channel }));
        }}
      >
        <Input label={t("onboarding.contact.phone")} leading="+998" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label={t("onboarding.contact.telegram")} leading="@" autoCapitalize="none" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
        <Input label={t("onboarding.contact.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!p?.email} />
        <ChipGroup
          label={t("onboarding.contact.channel")}
          options={CHANNELS}
          value={[channel]}
          onChange={(v) => v[0] && setChannel(v[0])}
          labelOf={(c) => t(`onboarding.channel.${c}` as Key)}
        />
        <Actions error={error}>
          <Button type="submit" loading={busy}>
            {t("onboarding.next")}
          </Button>
          <SkipButton onSkip={onSkip} busy={busy} />
        </Actions>
      </form>
    </Card>
  );
}

function CompanyCard({ result, onConfirm, onReject }: { result: LookupResult; onConfirm: (index: number) => Promise<void>; onReject: () => void }) {
  const t = useT();
  const [index, setIndex] = useState(result.status === "found" ? 0 : -1);
  const { busy, error, run } = useAction();
  const c: CompanyCandidate | undefined = result.candidates[index];
  const rows: [Key, string][] = c
    ? [
        ["onboarding.business.inn", c.inn],
        ["onboarding.business.status", c.status],
        ["onboarding.business.registered", c.registered_at],
        ["onboarding.business.director", c.director],
        ["onboarding.business.address", c.address],
        ["onboarding.business.activity", [c.oked, c.activity].filter(Boolean).join(" · ")],
      ]
    : [];
  return (
    <Card tint="butter" className="flex flex-col gap-3">
      {index < 0 ? (
        <div className="flex flex-col gap-2">
          <Text variant="secondary">{t("onboarding.business.multiple")}</Text>
          {result.candidates.map((cand, i) => (
            <Button key={`${cand.inn}-${i}`} variant="secondary" block className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => setIndex(i)}>
              {cand.name}
              {cand.inn ? ` · ${cand.inn}` : ""}
            </Button>
          ))}
        </div>
      ) : c ? (
        <>
          <div className="flex items-start gap-3">
            <Building2 className="mt-1 size-5 shrink-0" aria-hidden="true" />
            <Text weight="semibold">{c.name}</Text>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <Text as="span" variant="caption" tone="muted">
                    {t(k)}
                  </Text>
                  <Text as="span" variant="caption">
                    {v}
                  </Text>
                </div>
              ))}
          </dl>
          <Badge tone={result.official ? "positive" : "caution"} className="self-start whitespace-normal">
            {t(result.official ? "onboarding.business.sourceOfficial" : "onboarding.business.sourceUnofficial", { source: result.source ?? "—" })}
          </Badge>
        </>
      ) : null}
      <Actions error={error}>
        {c ? (
          <Button loading={busy} icon={Check} onClick={() => run(() => onConfirm(index))}>
            {t("onboarding.business.confirm")}
          </Button>
        ) : null}
        <Button variant="ghost" disabled={busy} onClick={onReject}>
          {t("onboarding.business.notMine")}
        </Button>
      </Actions>
    </Card>
  );
}

export function BusinessCard({
  state,
  lookup,
  setLookup,
  onSubmit,
}: {
  state: OnboardingState;
  lookup: LookupResult | null;
  setLookup: (r: LookupResult | null) => void;
  onSubmit: Submit;
}) {
  const t = useT();
  const existing = state.prefill?.business;
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const [city, setCity] = useState("");
  const [legal, setLegal] = useState<(typeof LEGAL_FORMS)[number][]>([]);
  const [stage, setStage] = useState<("running" | "idea")[]>(["running"]);
  const search = useAction();
  const save = useAction();
  const unavailable = lookup && (lookup.status === "unavailable" || lookup.status === "not_found");

  useEffect(() => {
    if (!unavailable) return;
    const id = setTimeout(() => setManual(true), 0);
    return () => clearTimeout(id);
  }, [unavailable]);

  return (
    <div className="flex flex-col gap-3">
      {existing ? (
        <Card tint="mint" className="flex flex-col gap-3">
          <Text variant="secondary">{t("onboarding.business.existing", { name: existing.name })}</Text>
          <Actions error={save.error}>
            <Button loading={save.busy} onClick={() => save.run(() => onSubmit({ keep: true }))}>
              {t("onboarding.business.keep")}
            </Button>
          </Actions>
        </Card>
      ) : null}
      {lookup && (lookup.status === "found" || lookup.status === "multiple") ? (
        <CompanyCard result={lookup} onConfirm={(index) => onSubmit({ lookup_id: lookup.lookup_id, index })} onReject={() => { setLookup(null); setManual(true); }} />
      ) : (
        <Card className="flex flex-col gap-3">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void search.run(async () => setLookup(await lookupCompany(query)));
            }}
          >
            <Input
              label={t("onboarding.business.query")}
              hint={t("onboarding.business.queryHint")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="search"
            />
            <Actions error={search.error}>
              <Button type="submit" icon={Search} loading={search.busy} disabled={query.trim().length < 3}>
                {t("onboarding.business.search")}
              </Button>
              {!manual ? (
                <Button variant="ghost" onClick={() => setManual(true)}>
                  {t("onboarding.business.manual")}
                </Button>
              ) : null}
            </Actions>
          </form>
          {unavailable ? (
            <StatusBanner kind="info" title={t(lookup.status === "not_found" ? "onboarding.business.notFound" : "onboarding.business.unavailable")} />
          ) : null}
        </Card>
      )}
      {manual ? (
        <Card>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save.run(() => onSubmit({ name, city, legal_form: legal[0] ?? "", stage: stage[0] ?? "running" }));
            }}
          >
            <ChipGroup label={t("onboarding.business.stage")} options={["running", "idea"] as const} value={stage} onChange={setStage} labelOf={(s) => t(`onboarding.stage.${s}` as Key)} />
            <Input label={t("onboarding.biz.name")} value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label={t("onboarding.business.city")} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            <ChipGroup label={t("onboarding.business.legalForm")} options={LEGAL_FORMS} value={legal} onChange={setLegal} labelOf={(l) => t(`onboarding.legal.${l}` as Key)} />
            <Actions error={save.error}>
              <Button type="submit" loading={save.busy} disabled={!name.trim()}>
                {t("onboarding.business.create")}
              </Button>
            </Actions>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

const PLAN_FIELDS = [
  ["price", "onboarding.plan.price"],
  ["unit_cost", "onboarding.plan.unitCost"],
  ["units_per_month", "onboarding.plan.units"],
  ["fixed_costs_per_month", "onboarding.plan.fixed"],
  ["startup_costs", "onboarding.plan.startup"],
] as const;

export function ActivityCard({ state, onSubmit, onSkip }: { state: OnboardingState; onSubmit: Submit; onSkip: () => Promise<void> }) {
  const t = useT();
  const idea = state.answers?.business?.stage === "idea";
  const [activities, setActivities] = useState<(typeof ACTIVITIES)[number][]>([]);
  const [other, setOther] = useState("");
  const [team, setTeam] = useState<(typeof TEAM)[number][]>([]);
  const [plan, setPlan] = useState<Record<string, string>>({});
  const { busy, error, run } = useAction();
  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() =>
            onSubmit({
              activities,
              other: activities.includes("other") ? other.trim() : "",
              team_size: team[0] ?? "",
              ...(idea && plan.price ? { plan: Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, Number(v.replace(/\s/g, "")) || 0])) } : {}),
            }),
          );
        }}
      >
        <ChipGroup label={t("onboarding.activity.segment")} options={ACTIVITIES} value={activities} onChange={setActivities} max={ACTIVITIES.length} labelOf={(s) => t(`onboarding.segment.${s}` as Key)} />
        {activities.includes("other") ? (
          <Input label={t("onboarding.activity.other")} value={other} maxLength={ACTIVITY_OTHER_MAX} onChange={(e) => setOther(e.target.value)} />
        ) : null}
        <ChipGroup label={t("onboarding.activity.team")} options={TEAM} value={team} onChange={setTeam} labelOf={(s) => t(`onboarding.team.${s}` as Key)} />
        {idea ? (
          <PastelCard tone="lavender" title={t("onboarding.plan.title")} className="flex flex-col gap-3">
            {PLAN_FIELDS.map(([field, key]) => (
              <Input key={field} label={t(key)} inputMode="numeric" value={plan[field] ?? ""} onChange={(e) => setPlan({ ...plan, [field]: e.target.value })} />
            ))}
          </PastelCard>
        ) : null}
        <Actions error={error}>
          <Button type="submit" loading={busy} disabled={!activities.length || (activities.length === 1 && activities[0] === "other" && !other.trim())}>
            {t("onboarding.next")}
          </Button>
          <SkipButton onSkip={onSkip} busy={busy} />
        </Actions>
      </form>
    </Card>
  );
}

export function PlanResult({ plan }: { plan: Plan }) {
  const t = useT();
  const [locale] = useLocale();
  const n = (v: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 0 }).format(v);
  return (
    <PastelCard tone="mint" title={t("onboarding.plan.resultTitle")} className="flex flex-col gap-1">
      <Text variant="secondary">{t("onboarding.plan.margin", { value: n(plan.margin) })}</Text>
      <Text variant="secondary">{t("onboarding.plan.profit", { value: n(plan.monthly_profit) })}</Text>
      <Text variant="secondary">
        {plan.breakeven_units != null ? t("onboarding.plan.breakeven", { value: n(plan.breakeven_units) }) : t("onboarding.plan.noBreakeven")}
      </Text>
      {plan.payback_months != null ? <Text variant="secondary">{t("onboarding.plan.payback", { value: plan.payback_months })}</Text> : null}
    </PastelCard>
  );
}

export function TagsCard({
  kind,
  onSubmit,
  onSkip,
}: {
  kind: "pains" | "goals";
  onSubmit: Submit;
  onSkip: () => Promise<void>;
}) {
  const t = useT();
  const options = kind === "pains" ? PAINS : GOALS;
  const max = kind === "pains" ? 3 : 2;
  const [chosen, setChosen] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const { busy, error, run } = useAction();
  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => onSubmit({ tags: chosen, other }));
        }}
      >
        <ChipGroup
          label={t(`onboarding.${kind}.hint` as Key)}
          options={options as readonly string[]}
          value={chosen}
          onChange={setChosen}
          max={max}
          labelOf={(o) => t(`onboarding.${kind === "pains" ? "pain" : "goal"}.${o}` as Key)}
        />
        <Input label={t(`onboarding.${kind}.other` as Key)} value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} />
        <Actions error={error}>
          <Button type="submit" loading={busy} disabled={!chosen.length && !other.trim()}>
            {t("onboarding.next")}
          </Button>
          <SkipButton onSkip={onSkip} busy={busy} />
        </Actions>
      </form>
    </Card>
  );
}

export function UploadCard({ state, onSubmit, onSkip }: { state: OnboardingState; onSubmit: Submit; onSkip: () => Promise<void> }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const { busy, error, run } = useAction();
  const [localError, setLocalError] = useState<string | null>(null);
  const canImport = state.role !== "seller";
  return (
    <Card className="flex flex-col gap-3">
      <Text variant="secondary" tone="muted">
        {t("onboarding.upload.hint")}
      </Text>
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls,.txt,.xml"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > MAX_UPLOAD_BYTES) return setLocalError(t("onboarding.upload.tooBig"));
          setLocalError(null);
          void run(async () => setJob(await uploadImport(file)));
        }}
      />
      {job ? (
        <PastelCard tone="sky">
          <Text variant="secondary">{t("onboarding.upload.preview", { count: job.total_rows, name: job.filename })}</Text>
        </PastelCard>
      ) : null}
      <Actions error={localError ?? error}>
        {job ? (
          <Button
            loading={busy}
            icon={Check}
            onClick={() =>
              run(async () => {
                const done = await commitImport(job.id, true);
                await onSubmit({ source: "import", import_id: done.id });
              })
            }
          >
            {t("onboarding.upload.commit", { count: job.total_rows })}
          </Button>
        ) : canImport ? (
          <Button icon={Upload} loading={busy} onClick={() => input.current?.click()}>
            {t("onboarding.upload.pick")}
          </Button>
        ) : null}
        <Button variant="secondary" disabled={busy} onClick={() => run(() => onSubmit({ source: "zero" }))}>
          {t("onboarding.upload.zero")}
        </Button>
        <SkipButton onSkip={onSkip} busy={busy} />
      </Actions>
    </Card>
  );
}

export function InviteCard({ state, onSubmit, onSkip }: { state: OnboardingState; onSubmit: Submit; onSkip: () => Promise<void> }) {
  const t = useT();
  const [role, setRole] = useState<Invite["role"][]>(["accountant"]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const { busy, error, run } = useAction();
  const businessId = state.prefill?.business?.id;
  const link = (i: Invite) => `${window.location.origin}/join/${i.code}`;
  return (
    <Card className="flex flex-col gap-3">
      <ChipGroup label={t("onboarding.invite.role")} options={["accountant", "seller"] as const} value={role} onChange={setRole} labelOf={(r) => t(`onboarding.role.${r}` as Key)} />
      {invites.map((i) => (
        <PastelCard key={i.id} tone="peach" className="flex flex-col gap-2">
          <Text variant="caption" tone="muted">
            {t(`onboarding.role.${i.role}` as Key)}
          </Text>
          <Text variant="secondary" className="break-all">
            {link(i)}
          </Text>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={copied === i.id ? Check : Copy}
              onClick={() => void navigator.clipboard?.writeText(link(i)).then(() => setCopied(i.id))}
            >
              {t(copied === i.id ? "onboarding.invite.copied" : "onboarding.invite.copy")}
            </Button>
            <Button size="sm" variant="secondary" icon={Send} asChild>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(link(i))}`} target="_blank" rel="noreferrer">
                {t("onboarding.invite.telegram")}
              </a>
            </Button>
          </div>
        </PastelCard>
      ))}
      <Actions error={error}>
        <Button
          variant={invites.length ? "secondary" : "primary"}
          loading={busy}
          disabled={!businessId || !role[0]}
          onClick={() => run(async () => setInvites([...invites, await createInvite(businessId!, role[0])]))}
        >
          {t("onboarding.invite.create")}
        </Button>
        {invites.length ? (
          <Button disabled={busy} onClick={() => run(() => onSubmit({ invite_ids: invites.map((i) => i.id) }))}>
            {t("onboarding.next")}
          </Button>
        ) : (
          <SkipButton onSkip={onSkip} busy={busy} />
        )}
      </Actions>
    </Card>
  );
}

// ─── Акт 2 ────────────────────────────────────────────────────────────────────────────────────────

export function InstallCard({ onSubmit }: { onSubmit: Submit }) {
  const t = useT();
  const { mode, install } = useInstall();
  const { busy, error, run } = useAction();
  const text: Record<typeof mode, Key> = {
    installed: "onboarding.install.installed",
    prompt: "onboarding.install.android",
    ios: "onboarding.install.ios",
    manual: "onboarding.install.manual",
  };
  return (
    <Card tint="lavender" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {mode === "ios" ? <Share className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <Download className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
        <Text variant="secondary">{t(text[mode])}</Text>
      </div>
      <Actions error={error}>
        {mode === "prompt" ? (
          <Button loading={busy} icon={Download} onClick={() => run(async () => onSubmit({ installed: await install() }))}>
            {t("onboarding.install.button")}
          </Button>
        ) : (
          <Button loading={busy} onClick={() => run(() => onSubmit({ installed: mode === "installed" }))}>
            {t(mode === "installed" ? "onboarding.next" : "onboarding.install.done")}
          </Button>
        )}
        {mode !== "installed" ? (
          <Button variant="ghost" disabled={busy} onClick={() => run(() => onSubmit({ installed: false }))}>
            {t("onboarding.install.later")}
          </Button>
        ) : null}
      </Actions>
    </Card>
  );
}

const TOUR = [
  { icon: Home, tone: "butter", title: "onboarding.tour.home", hint: "onboarding.tour.homeHint" },
  { icon: ListOrdered, tone: "mint", title: "onboarding.tour.ops", hint: "onboarding.tour.opsHint" },
  { icon: Mic, tone: "peach", title: "onboarding.tour.mic", hint: "onboarding.tour.micHint" },
  { icon: MessageCircle, tone: "sky", title: "onboarding.tour.assistant", hint: "onboarding.tour.assistantHint" },
] as const;

export function TourCard({ state, onSubmit, onSkip }: { state: OnboardingState; onSubmit: Submit; onSkip: () => Promise<void> }) {
  const t = useT();
  const [time, setTime] = useState(state.prefill?.brief_time ?? "08:30");
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {TOUR.map((s) => (
          <PastelCard key={s.title} tone={s.tone} className="w-[78%] shrink-0 snap-center">
            <s.icon className="mb-2 size-6" aria-hidden="true" />
            <Text weight="semibold">{t(s.title)}</Text>
            <Text variant="secondary" tone="muted">
              {t(s.hint)}
            </Text>
          </PastelCard>
        ))}
      </div>
      <Card>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => onSubmit({ brief_time: time }));
          }}
        >
          <Input label={t("onboarding.tour.briefTime")} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Actions error={error}>
            <Button type="submit" loading={busy}>
              {t("onboarding.next")}
            </Button>
            <SkipButton onSkip={onSkip} busy={busy} />
          </Actions>
        </form>
      </Card>
    </div>
  );
}

export function SummaryCard({ onFinish }: { onFinish: () => Promise<void> }) {
  const t = useT();
  const [ctx, setCtx] = useState<MemoryContext | null>(null);
  const load = useAction();
  const finish = useAction();
  useEffect(() => {
    void load.run(async () => setCtx(await getMemory()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const biz = ctx?.business;
  return (
    <Card tint="butter" className="flex flex-col gap-3">
      {!ctx && !load.error ? <SkeletonText lines={4} /> : null}
      {load.error ? <StatusBanner kind="error" title={load.error} /> : null}
      {biz ? (
        <div className="flex flex-col gap-1">
          <Text weight="semibold">{biz.name}</Text>
          {biz.inn ? <Text variant="caption" tone="muted">{t("onboarding.business.inn")}: {biz.inn}</Text> : null}
          {biz.activity ? <Text variant="secondary">{biz.activity}</Text> : null}
        </div>
      ) : null}
      {ctx ? (
        ctx.memory.length ? (
          <ul className="flex flex-col gap-1.5" aria-label={t("onboarding.summary.memory")}>
            {ctx.memory.map((f) => (
              <li key={f.id} className="flex gap-2">
                <Check className="mt-1 size-4 shrink-0" aria-hidden="true" />
                <Text variant="secondary">{f.text}</Text>
              </li>
            ))}
          </ul>
        ) : (
          <Text variant="secondary" tone="muted">
            {t("onboarding.summary.empty")}
          </Text>
        )
      ) : null}
      <Text variant="caption" tone="muted">
        {t("onboarding.summary.editHint")}
      </Text>
      <Actions error={finish.error}>
        <Button block size="lg" loading={finish.busy} onClick={() => finish.run(onFinish)}>
          {t("onboarding.summary.finish")}
        </Button>
      </Actions>
    </Card>
  );
}
