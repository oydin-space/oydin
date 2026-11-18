"use client";

import { Ban, Check, Copy, Link2, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, ErrorState, Icon, ListGroup, ListRow, SegmentedControl, Sheet, SkeletonList, toast } from "@/components/ui";
import { errorText } from "@/lib/auth-api";
import { useT } from "@/i18n";
import { createInvite, inviteUrl, listInvites, revokeInvite, telegramShareUrl, type Invite, type InviteRole } from "./invite-api";
import { roleLabel } from "./roles";

const EXPIRY = ["24", "168", "720"] as const;
const USES = ["1", "5", "20"] as const;

export function InviteLinks({ businessId, businessName }: { businessId: number; businessName: string }) {
  const t = useT();
  const [items, setItems] = useState<Invite[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<InviteRole>("accountant");
  const [hours, setHours] = useState<string>("168");
  const [uses, setUses] = useState<string>("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Invite | null>(null);
  const errors: Record<string, string> = {
    rate_limited: t("settings.invite.err.rate_limited"),
    http_429: t("settings.invite.err.rate_limited"),
    http_403: t("settings.invite.err.forbidden"),
  };

  const load = useCallback(async () => {
    try {
      setItems(await listInvites(businessId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [businessId]);
  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setCreated(await createInvite(businessId, { role, expires_in_hours: Number(hours), max_uses: Number(uses) }));
      await load();
    } catch (e) {
      setError(errorText(e, errors, t("settings.common.generic")));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(i: Invite) {
    try {
      await revokeInvite(businessId, i.id);
      await load();
    } catch (e) {
      toast.error(errorText(e, errors, t("settings.common.generic")));
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("settings.common.copied"));
    } catch {
      toast.error(t("settings.common.generic"));
    }
  }

  const close = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setCreated(null);
      setError(null);
    }
  };
  const roleOptions = (["accountant", "seller"] as const).map((r) => ({ value: r, label: roleLabel(t, r) }));
  const url = created ? inviteUrl(created.code) : "";
  const shareText = created ? t("settings.invite.shareText", { business: businessName, role: roleLabel(t, created.role) }) : "";

  return (
    <section className="flex flex-col gap-3" aria-label={t("settings.invite.title")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-title"><Icon icon={Link2} size={20} />{t("settings.invite.title")}</h2>
        <Button icon={Link2} variant="secondary" onClick={() => setOpen(true)}>{t("settings.invite.create")}</Button>
      </div>
      <p className="text-caption text-muted-foreground">{t("settings.invite.hint")}</p>
      {failed ? (
        <ErrorState message={t("settings.invite.loadError")} onRetry={() => void load()} />
      ) : !items ? (
        <SkeletonList rows={2} />
      ) : items.filter((i) => i.status === "active").length === 0 ? null : (
        <ListGroup>
          {items.filter((i) => i.status === "active").map((i) => (
            <ListRow
              key={i.id}
              title={roleLabel(t, i.role)}
              leading={<Icon icon={Link2} size={20} className="text-muted-foreground" />}
              subtitle={t("settings.invite.meta", { uses: i.uses, max: i.max_uses, date: new Date(i.expires_at).toLocaleDateString() })}
              trailing={<Button size="sm" variant="ghost" icon={Ban} onClick={() => void revoke(i)}>{t("settings.common.revoke")}</Button>}
            />
          ))}
        </ListGroup>
      )}

      <Sheet open={open} onOpenChange={close} title={t("settings.invite.sheetTitle")}>
        {created ? (
          <div className="flex flex-col gap-3">
            <p className="break-all rounded-card bg-surface-sunken p-3 text-small" data-testid="invite-url">{url}</p>
            <Button icon={Copy} block onClick={() => void copy(url)}>{t("settings.common.copy")}</Button>
            <Button icon={Send} variant="secondary" block onClick={() => window.open(telegramShareUrl(url, shareText), "_blank", "noopener")}>
              {t("settings.invite.telegram")}
            </Button>
            <Button variant="ghost" icon={X} block onClick={() => close(false)}>{t("settings.common.close")}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <SegmentedControl label={t("settings.invite.role")} value={role} onValueChange={setRole} options={roleOptions} />
            <SegmentedControl
              label={t("settings.invite.expiry")}
              value={hours}
              onValueChange={setHours}
              options={EXPIRY.map((h) => ({ value: h, label: t(`settings.invite.expiry.${h}`) }))}
            />
            <SegmentedControl
              label={t("settings.invite.uses")}
              value={uses}
              onValueChange={setUses}
              options={USES.map((u) => ({ value: u, label: u }))}
            />
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button block icon={Check} loading={busy} onClick={() => void create()}>{t("settings.common.create")}</Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
