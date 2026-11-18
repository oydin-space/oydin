"use client";

import { Ban, Check, Handshake, ScrollText, ShieldCheck, Store } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Badge, Button, ChoiceControl, FeedbackNotice, Icon, ListGroup, ListRow, PlainCard, SkeletonList } from "@/components/ui";
import { type ConsentPurpose, type Consents, fetchConsents, grantPartnerConsent, listPartnerConsents, revokePartnerConsent, saveConsents } from "@/lib/settings-api";
import { ResourceGate } from "./resource-gate";
import { useResource } from "./use-resource";
import { useST } from "./use-st";

const PURPOSES: ConsentPurpose[] = ["ai", "marketing", "partner_leads"];

function ConsentToggles({ initial }: { initial: Consents }) {
  const { t, err } = useST();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<ConsentPurpose | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(p: ConsentPurpose, value: boolean) {
    setBusy(p);
    setError(null);
    try {
      setState(await saveConsents({ [p]: value }));
    } catch (x) {
      setError(err(x));
    } finally {
      setBusy(null);
    }
  }

  return (
    <PlainCard title={<span className="inline-flex items-center gap-2"><Icon icon={ShieldCheck} size={20} />{t("settings.privacy.title")}</span>} description={t("settings.privacy.hint")}>
      <div className="flex flex-col gap-4">
        {PURPOSES.map((p) => (
          <ChoiceControl
            key={p}
            kind="switch"
            label={t(`settings.consent.${p}.title`)}
            description={t(`settings.consent.${p}.desc`)}
            checked={state[p]}
            disabled={busy !== null}
            onCheckedChange={(v) => toggle(p, v)}
          />
        ))}
        {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
        {state.terms_version ? <p className="text-small text-muted-foreground">{t("settings.privacy.version", { version: state.terms_version })}</p> : null}
      </div>
    </PlainCard>
  );
}

function PartnerConsents() {
  const { t, err } = useST();
  const { data, loading, error, reload } = useResource(listPartnerConsents);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function change(id: number, granted: boolean) {
    setBusy(id);
    setActionError(null);
    try {
      await (granted ? revokePartnerConsent(id) : grantPartnerConsent(id));
      reload();
    } catch (x) {
      setActionError(err(x));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="partners-h">
      <h2 id="partners-h" className="flex items-center gap-2 text-title font-semibold"><Icon icon={Handshake} size={20} />{t("settings.partners.title")}</h2>
      <p className="text-small text-muted-foreground">{t("settings.partners.hint")}</p>
      <ResourceGate loading={loading} error={error} onRetry={reload} skeleton={<SkeletonList rows={2} />}>
        {data && data.length === 0 ? (
          <p className="text-small text-muted-foreground">{t("settings.partners.empty")}. {t("settings.partners.emptyHint")}</p>
        ) : (
          <ListGroup>
            {data?.map((c) => (
              <ListRow
                key={c.partner.id}
                title={c.partner.name}
                leading={<Icon icon={Store} size={20} className="text-muted-foreground" />}
                subtitle={c.partner.kind}
                status={<Badge tone={c.granted ? "positive" : "neutral"}>{c.granted ? t("settings.partners.granted") : t("settings.partners.revoked")}</Badge>}
                trailing={
                  <Button size="sm" variant={c.granted ? "secondary" : "primary"} icon={c.granted ? Ban : Check} loading={busy === c.partner.id} onClick={() => change(c.partner.id, c.granted)}>
                    {c.granted ? t("settings.partners.revoke") : t("settings.partners.grant")}
                  </Button>
                }
              />
            ))}
          </ListGroup>
        )}
      </ResourceGate>
      {actionError ? <FeedbackNotice kind="error">{actionError}</FeedbackNotice> : null}
    </section>
  );
}

export function PrivacySection() {
  const { t } = useST();
  const { user } = useSession();
  const consents = useResource(fetchConsents);
  return (
    <div className="flex flex-col gap-6">
      <ResourceGate loading={consents.loading} error={consents.error} onRetry={consents.reload} skeleton={<SkeletonList rows={3} />}>
        {consents.data ? <ConsentToggles initial={consents.data} /> : null}
      </ResourceGate>
      {user?.role === "owner" ? <PartnerConsents /> : null}
      <ListGroup header={t("settings.privacy.links")}>
        <ListRow title={t("settings.profile.privacy")} href="/privacy" chevron leading={<Icon icon={ShieldCheck} size={20} className="text-muted-foreground" />} />
        <ListRow title={t("settings.profile.terms")} href="/terms" chevron leading={<Icon icon={ScrollText} size={20} className="text-muted-foreground" />} />
      </ListGroup>
    </div>
  );
}
