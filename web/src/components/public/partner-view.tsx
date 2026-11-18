"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Lock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Icon, ListGroup, ListRow, SegmentedControl, Sheet, SkeletonList, StatusBanner, Text } from "@/components/ui";
import { usePublicT } from "./use-public-t";
import { ApiError } from "@/lib/api";
import { fetchPartnerLeads, fetchPartnerMe, LEAD_STATUSES, REQUEST_ACCESS_URL, setLeadStatus, type LeadStatus, type PartnerLead, type PartnerMe } from "@/lib/public-api";
import { PublicShell } from "./public-shell";
import { PublicTitle } from "./page-title";

type Load =
  | { state: "loading" }
  | { state: "login" | "notPartner" | "error" }
  | { state: "ready"; me: PartnerMe; leads: PartnerLead[] };

const STATUS_TONE = { new: "caution", contacted: "neutral", closed: "positive" } as const;

export function PartnerView() {
  const t = usePublicT();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPartnerMe(), fetchPartnerLeads()])
      .then(([me, { items }]) => !cancelled && setLoad({ state: "ready", me, leads: items }))
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) setLoad({ state: "login" });
        else if (e instanceof ApiError && e.status === 403) setLoad({ state: "notPartner" });
        else setLoad({ state: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const retry = useCallback(() => {
    setLoad({ state: "loading" });
    setTick((n) => n + 1);
  }, []);

  return (
    <PublicShell>
      <PublicTitle title={t("public.partner.title")} hint={t("public.partner.desc")} />
      {load.state === "loading" ? <div aria-busy="true"><SkeletonList /></div> : null}
      {load.state === "error" ? <ErrorState message={t("public.partner.error")} onRetry={retry} retryLabel={t("public.retry")} /> : null}
      {load.state === "login" ? (
        <EmptyState
          title={t("public.partner.loginTitle")}
          hint={t("public.partner.loginHint")}
          action={<Button asChild icon={Lock}><Link href="/login?next=/partner">{t("public.partner.login")}</Link></Button>}
        />
      ) : null}
      {load.state === "notPartner" ? (
        <StatusBanner
          kind="info"
          title={t("public.partner.notPartner")}
          action={<Button asChild size="sm" variant="secondary" icon={ExternalLink}><a href={REQUEST_ACCESS_URL} target="_blank" rel="noopener noreferrer">{t("public.partner.become")}</a></Button>}
        >
          {t("public.partner.notPartnerHint")}
        </StatusBanner>
      ) : null}
      {load.state === "ready" ? <Cabinet me={load.me} initial={load.leads} /> : null}
    </PublicShell>
  );
}

function Cabinet({ me, initial }: { me: PartnerMe; initial: PartnerLead[] }) {
  const t = usePublicT();
  const [leads, setLeads] = useState(initial);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const open = leads.find((l) => l.id === openId) ?? null;
  const shown = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  async function changeStatus(lead: PartnerLead, status: LeadStatus) {
    if (status === lead.status) return;
    setSaving(true);
    try {
      const next = await setLeadStatus(lead.id, status);
      setLeads((all) => all.map((l) => (l.id === next.id ? next : l)));
      toast.success(t("public.partner.saved"));
    } catch {
      toast.error(t("public.partner.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card tint="lavender" className="flex items-center gap-3">
        <Icon icon={Building2} size={24} />
        <div className="min-w-0">
          <p className="truncate text-body font-semibold">{me.partner.name}</p>
          <Text variant="secondary" tone="muted">
            {t(`public.partner.kind.${me.partner.kind}`)} · {t("public.partner.signedIn", { name: me.name })}
          </Text>
        </div>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="leads-h">
        <h2 id="leads-h" className="text-title font-semibold">{t("public.partner.leads")}</h2>
        <Text variant="secondary" tone="muted">{t("public.partner.privacy")}</Text>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("public.partner.setStatus")}>
          {(["all", ...LEAD_STATUSES] as const).map((s) => (
            <Chip key={s} selected={filter === s} onSelect={() => setFilter(s)}>
              {s === "all" ? t("public.partner.filter.all") : t(`public.partner.status.${s}`)}
            </Chip>
          ))}
        </div>
        {shown.length === 0 ? (
          leads.length === 0 ? <EmptyState title={t("public.partner.empty")} hint={t("public.partner.emptyHint")} /> : <EmptyState title={t("public.partner.emptyFilter")} />
        ) : (
          <ListGroup>
            {shown.map((l) => (
              <ListRow
                key={l.id}
                leading={<Icon icon={MapPin} />}
                title={`${l.city || t("public.partner.unknown")} · ${segmentName(t, l.segment)}`}
                subtitle={`${t("public.partner.revenue")}: ${l.revenue_band}`}
                status={<Badge tone={STATUS_TONE[l.status]}>{t(`public.partner.status.${l.status}`)}</Badge>}
                onClick={() => setOpenId(l.id)}
              />
            ))}
          </ListGroup>
        )}
      </section>

      <Sheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open ? t("public.partner.lead", { id: open.id.slice(0, 8) }) : ""}
        closeLabel={t("public.partner.close")}
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
              <Row label={t("public.partner.city")} value={open.city || t("public.partner.unknown")} />
              <Row label={t("public.partner.segment")} value={segmentName(t, open.segment)} />
              <Row label={t("public.partner.months")} value={String(open.months_active)} />
              <Row label={t("public.partner.revenue")} value={open.revenue_band} />
              <Row label={t("public.partner.gap")} value={open.gap_amount_band ?? t("public.partner.noGap")} />
              {open.gap_date ? <Row label={t("public.partner.gapDate")} value={open.gap_date} /> : null}
              <Row label={t("public.partner.consented")} value={open.consented_at.slice(0, 10)} />
            </dl>
            <SegmentedControl<LeadStatus>
              label={t("public.partner.setStatus")}
              value={open.status}
              onValueChange={(s) => !saving && void changeStatus(open, s)}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: t(`public.partner.status.${s}`), disabled: saving }))}
            />
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </>
  );
}

const SEGMENTS = ["textile_print", "retail", "horeca", "marketplace_seller", "services"];
const segmentName = (t: (k: string) => string, segment: string) => (SEGMENTS.includes(segment) ? t(`public.partner.segment.${segment}`) : segment);
