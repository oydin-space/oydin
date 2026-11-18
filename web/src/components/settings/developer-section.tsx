"use client";

import { Ban, BookOpen, KeyRound, Plus, Send, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button, ChoiceControl, EmptyState, FeedbackNotice, Icon, Input, ListGroup, ListRow, PlainCard, Section } from "@/components/ui";
import {
  type ApiTokenItem,
  createToken,
  createWebhook,
  deleteWebhook,
  listTokens,
  listWebhooks,
  patchWebhook,
  pingWebhook,
  revokeToken,
  TOKEN_SCOPES,
  type TokenScope,
  WEBHOOK_EVENTS,
  type WebhookEvent,
  type WebhookItem,
} from "@/lib/settings-api";
import { ResourceGate } from "./resource-gate";
import { SecretBox } from "./secret-box";
import { ConfirmDialog, FormSheet } from "./sheets";
import { useResource } from "./use-resource";
import { useST } from "./use-st";

function toggled<T>(list: T[], item: T, on: boolean): T[] {
  return on ? [...list.filter((x) => x !== item), item] : list.filter((x) => x !== item);
}

function TokensPanel() {
  const { t, err, formatDate } = useST();
  const { data, loading, error, reload } = useResource(listTokens);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<TokenScope[]>(["read"]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [target, setTarget] = useState<ApiTokenItem | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setFormError(t("settings.profile.nameRequired"));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const made = await createToken(name.trim(), scopes);
      setSecret(made.token);
      setName("");
      setOpen(false);
      reload();
    } catch (x) {
      setFormError(err(x));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!target) return;
    setBusy(true);
    try {
      await revokeToken(target.id);
      toast(t("settings.tokens.revoked"));
      reload();
    } catch (x) {
      setProblem(err(x));
    } finally {
      setTarget(null);
      setBusy(false);
    }
  }

  return (
    <Section
      title={t("settings.tokens.title")}
      action={
        <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>
          {t("settings.tokens.new")}
        </Button>
      }
    >
      {secret ? <SecretBox title={t("settings.tokens.createdTitle")} label={t("settings.tokens.title")} value={secret} /> : null}
      {problem ? <FeedbackNotice kind="error">{problem}</FeedbackNotice> : null}
      <ResourceGate loading={loading} error={error} onRetry={reload}>
        {data && data.length === 0 ? (
          <EmptyState title={t("settings.tokens.empty")} hint={t("settings.tokens.emptyHint")} />
        ) : (
          <ListGroup>
            {data?.map((k) => (
              <ListRow
                key={k.id}
                title={k.name}
                leading={<Icon icon={KeyRound} size={20} className="text-muted-foreground" />}
                subtitle={`${k.prefix}… · ${k.last_used_at ? t("settings.tokens.lastUsed", { date: formatDate(k.last_used_at) }) : t("settings.tokens.neverUsed")}`}
                status={
                  <>
                    {k.scopes.map((s) => (
                      <Badge key={s}>{t(`settings.tokens.scope.${s}`)}</Badge>
                    ))}
                  </>
                }
                trailing={
                  <Button size="sm" variant="ghost" icon={Ban} onClick={() => setTarget(k)}>
                    {t("settings.common.revoke")}
                  </Button>
                }
              />
            ))}
          </ListGroup>
        )}
      </ResourceGate>
      <FormSheet open={open} onOpenChange={setOpen} title={t("settings.tokens.new")} submitLabel={t("settings.common.create")} onSubmit={create} submitting={busy} dirty={!!name}>
        <div className="flex flex-col gap-3">
          <Input label={t("settings.tokens.name")} placeholder={t("settings.tokens.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-small font-medium">{t("settings.tokens.scopes")}</legend>
            {TOKEN_SCOPES.map((s) => (
              <ChoiceControl key={s} kind="checkbox" label={t(`settings.tokens.scope.${s}`)} checked={scopes.includes(s)} onCheckedChange={(v) => setScopes((cur) => toggled(cur, s, v))} />
            ))}
          </fieldset>
          {formError ? <FeedbackNotice kind="error">{formError}</FeedbackNotice> : null}
        </div>
      </FormSheet>
      <ConfirmDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)} title={t("settings.tokens.revokeTitle")} description={t("settings.tokens.revokeHint")} confirmLabel={t("settings.common.revoke")} busy={busy} onConfirm={revoke} />
    </Section>
  );
}

function WebhooksPanel() {
  const { t, err } = useST();
  const { data, loading, error, reload } = useResource(listWebhooks);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["transaction.created"]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [target, setTarget] = useState<WebhookItem | null>(null);
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function create() {
    if (events.length === 0) {
      setFormError(t("settings.webhooks.eventsRequired"));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const made = await createWebhook(url.trim(), events);
      setSecret(made.secret);
      setUrl("");
      setOpen(false);
      reload();
    } catch (x) {
      setFormError(err(x));
    } finally {
      setBusy(false);
    }
  }

  async function rowAction(id: number, action: () => Promise<void>) {
    setRowBusy(id);
    setMessage(null);
    try {
      await action();
    } catch (x) {
      setMessage({ kind: "error", text: err(x) });
    } finally {
      setRowBusy(null);
    }
  }

  const ping = (w: WebhookItem) =>
    rowAction(w.id, async () => {
      const { status } = await pingWebhook(w.id);
      const ok = typeof status === "number" ? status >= 200 && status < 300 : status === "ok";
      setMessage(ok ? { kind: "success", text: t("settings.webhooks.pingOk", { status: String(status) }) } : { kind: "error", text: t("settings.webhooks.pingFail") });
      reload();
    });

  const remove = async () => {
    if (!target) return;
    await rowAction(target.id, async () => {
      await deleteWebhook(target.id);
      toast(t("settings.webhooks.deleted"));
      reload();
    });
    setTarget(null);
  };

  return (
    <Section
      title={t("settings.webhooks.title")}
      action={
        <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>
          {t("settings.webhooks.new")}
        </Button>
      }
    >
      {secret ? <SecretBox title={t("settings.webhooks.createdTitle")} label={t("settings.webhooks.secretLabel")} value={secret} /> : null}
      {message ? <FeedbackNotice kind={message.kind}>{message.text}</FeedbackNotice> : null}
      <ResourceGate loading={loading} error={error} onRetry={reload}>
        {data && data.length === 0 ? (
          <EmptyState title={t("settings.webhooks.empty")} hint={t("settings.webhooks.emptyHint")} />
        ) : (
          <div className="flex flex-col gap-3">
            {data?.map((w) => (
              <PlainCard key={w.id} title={<span className="inline-flex items-center gap-2"><Icon icon={Webhook} size={20} />{w.url}</span>} description={w.events.map((e) => t(`settings.webhooks.event.${e}`)).join(" · ")}>
                <div className="flex flex-col gap-3">
                  <ChoiceControl
                    kind="switch"
                    label={t("settings.webhooks.active")}
                    checked={w.active}
                    disabled={rowBusy === w.id}
                    onCheckedChange={(v) => rowAction(w.id, async () => { await patchWebhook(w.id, { active: v }); reload(); })}
                  />
                  {w.last_delivery_status != null ? <p className="text-small text-muted-foreground">{t("settings.webhooks.lastStatus", { status: String(w.last_delivery_status) })}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={Send} loading={rowBusy === w.id} onClick={() => ping(w)}>
                      {t("settings.webhooks.ping")}
                    </Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setTarget(w)}>
                      {t("settings.common.delete")}
                    </Button>
                  </div>
                </div>
              </PlainCard>
            ))}
          </div>
        )}
      </ResourceGate>
      <FormSheet open={open} onOpenChange={setOpen} title={t("settings.webhooks.new")} submitLabel={t("settings.common.create")} onSubmit={create} submitting={busy} dirty={!!url}>
        <div className="flex flex-col gap-3">
          <Input type="url" label={t("settings.webhooks.url")} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} required />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-small font-medium">{t("settings.webhooks.events")}</legend>
            {WEBHOOK_EVENTS.map((ev) => (
              <ChoiceControl key={ev} kind="checkbox" label={t(`settings.webhooks.event.${ev}`)} checked={events.includes(ev)} onCheckedChange={(v) => setEvents((cur) => toggled(cur, ev, v))} />
            ))}
          </fieldset>
          {formError ? <FeedbackNotice kind="error">{formError}</FeedbackNotice> : null}
        </div>
      </FormSheet>
      <ConfirmDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)} title={t("settings.webhooks.deleteTitle")} description={t("settings.webhooks.deleteHint")} confirmLabel={t("settings.common.delete")} busy={rowBusy !== null} onConfirm={remove} />
    </Section>
  );
}

export function DeveloperSection() {
  const { t } = useST();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-small text-muted-foreground">{t("settings.developer.hint")}</p>
      <PlainCard title={<span className="inline-flex items-center gap-2"><Icon icon={BookOpen} size={20} />{t("settings.developer.docsTitle")}</span>}>
        <p className="text-small">{t("settings.developer.docsBody")}</p>
      </PlainCard>
      <TokensPanel />
      <WebhooksPanel />
    </div>
  );
}
