"use client";

import { Check, Send, Trash2, User, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Badge, Button, EmptyState, ErrorState, Icon, Input, ListGroup, ListRow, PAGE_WIDTH, PageHeader, SegmentedControl, Sheet, SkeletonList } from "@/components/ui";
import { changeMemberRole, errorText, fetchProviders, inviteMember, listMembers, removeMember, type TeamMember } from "@/lib/auth-api";
import { useT } from "@/i18n";
import type { Role } from "@/lib/types";
import { ROLES, roleLabel } from "./roles";
import { InviteLinks } from "./invite-links";

type Panel = { kind: "invite" } | { kind: "member"; m: TeamMember } | { kind: "confirm"; m: TeamMember } | null;
const who = (m: TeamMember) => m.name || m.email || m.invited_email || "";

export function TeamView() {
  const t = useT();
  const { user } = useSession();
  const strings = {
    title: t("biz.team.title"),
    hint: t("biz.team.hint"),
    invite: t("biz.team.invite"),
    inviteTitle: t("biz.team.inviteTitle"),
    email: t("biz.team.email"),
    role: t("biz.team.role"),
    send: t("biz.team.send"),
    roleHints: { owner: t("biz.team.roleHint.owner"), accountant: t("biz.team.roleHint.accountant"), seller: t("biz.team.roleHint.seller") } satisfies Record<Role, string>,
    invited: t("biz.team.invited"),
    you: t("biz.team.you"),
    empty: t("biz.team.empty"),
    emptyHint: t("biz.team.emptyHint"),
    ownerOnly: t("biz.team.ownerOnly"),
    ownerOnlyHint: t("biz.team.ownerOnlyHint"),
    save: t("biz.team.save"),
    remove: t("biz.team.remove"),
    confirmRemove: (who: string) => t("biz.team.confirmRemove", { who }),
    confirm: t("biz.team.confirm"),
    cancel: t("biz.team.cancel"),
    loadError: t("biz.team.loadError"),
    generic: t("biz.generic"),
    errors: {
      last_owner: t("biz.team.err.last_owner"),
      already_member: t("biz.team.err.already_member"),
      http_403: t("biz.team.err.http_403"),
      http_404: t("biz.team.err.http_404"),
      http_400: t("biz.team.err.http_400"),
    } as Record<string, string>,
  };
  const businessId = user?.active_business_id ?? null;
  const isOwner = user?.role === "owner";
  const [items, setItems] = useState<TeamMember[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("accountant");
  const [emailLogin, setEmailLogin] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    fetchProviders().then((p) => !off && setEmailLogin(p.email), () => undefined);
    return () => {
      off = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (businessId == null) return;
    try {
      setItems(await listMembers(businessId));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [businessId]);
  useEffect(() => {
    if (!isOwner || businessId == null) return;
    let off = false;
    listMembers(businessId).then(
      (list) => !off && (setItems(list), setLoadFailed(false)),
      () => !off && setLoadFailed(true),
    );
    return () => {
      off = true;
    };
  }, [isOwner, businessId]);

  const open = (p: Panel) => {
    setError(null);
    setEmail("");
    setRole(p?.kind === "member" ? p.m.role : "accountant");
    setPanel(p);
  };

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setPanel(null);
      await load();
    } catch (e) {
      setError(errorText(e, strings.errors, strings.generic));
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) return <EmptyState title={strings.ownerOnly} hint={strings.ownerOnlyHint} />;
  const id = businessId as number;
  const label = (m: TeamMember) => `${roleLabel(t, m.role)}${m.user_id === user?.id ? ` · ${strings.you}` : ""}`;
  const roleOptions = ROLES.map((r) => ({ value: r, label: roleLabel(t, r) }));

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-4`}>
      <PageHeader title={strings.title} hint={strings.hint} actions={<Button icon={UserPlus} onClick={() => (emailLogin ? open({ kind: "invite" }) : setLinkOpen(true))}>{strings.invite}</Button>} />
      {loadFailed ? (
        <ErrorState message={strings.loadError} onRetry={() => { setLoadFailed(false); void load(); }} />
      ) : !items ? (
        <SkeletonList rows={3} />
      ) : items.length <= 1 && items.every((m) => m.user_id === user?.id) ? (
        <>
          <ListGroup>{items.map((m) => <ListRow key={m.id} title={who(m)} leading={<Icon icon={User} size={20} className="text-muted-foreground" />} subtitle={label(m)} />)}</ListGroup>
          <EmptyState title={strings.empty} hint={strings.emptyHint} />
        </>
      ) : (
        <ListGroup>
          {items.map((m) => (
            <ListRow
              key={m.id}
              title={who(m)}
              leading={<Icon icon={User} size={20} className="text-muted-foreground" />}
              subtitle={m.email && m.email !== who(m) ? `${m.email} · ${label(m)}` : label(m)}
              status={m.status === "invited" ? <Badge tone="caution">{strings.invited}</Badge> : undefined}
              onClick={() => open({ kind: "member", m })}
            />
          ))}
        </ListGroup>
      )}

      <InviteLinks businessId={id} businessName={user?.business?.name ?? ""} open={linkOpen} onOpenChange={setLinkOpen} noEmail={!emailLogin} />

      <Sheet
        open={panel !== null}
        onOpenChange={(v) => !v && setPanel(null)}
        title={panel?.kind === "invite" ? strings.inviteTitle : panel ? who(panel.m) : ""}
        description={panel?.kind === "confirm" ? strings.confirmRemove(who(panel.m)) : undefined}
      >
        {panel?.kind === "invite" ? (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void run(() => inviteMember(id, email.trim(), role)); }}>
            <Input type="email" label={strings.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
            <div className="flex flex-col gap-1.5">
              <p className="text-caption font-medium text-muted-foreground">{strings.role}</p>
              <SegmentedControl label={strings.role} value={role} onValueChange={setRole} options={roleOptions} />
            </div>
            <p className="text-caption text-muted-foreground">{strings.roleHints[role]}</p>
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button type="submit" icon={Send} block loading={busy}>{strings.send}</Button>
          </form>
        ) : panel?.kind === "member" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-caption font-medium text-muted-foreground">{strings.role}</p>
              <SegmentedControl label={strings.role} value={role} onValueChange={setRole} options={roleOptions} />
            </div>
            <p className="text-caption text-muted-foreground">{strings.roleHints[role]}</p>
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button block icon={Check} loading={busy} disabled={role === panel.m.role} onClick={() => void run(() => changeMemberRole(id, panel.m.id, role))}>{strings.save}</Button>
            <Button variant="destructive" icon={UserMinus} block onClick={() => { setError(null); setPanel({ kind: "confirm", m: panel.m }); }}>{strings.remove}</Button>
          </div>
        ) : panel?.kind === "confirm" ? (
          <div className="flex flex-col gap-3">
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button variant="destructive" icon={Trash2} block loading={busy} onClick={() => void run(() => removeMember(id, panel.m.id))}>{strings.confirm}</Button>
            <Button variant="ghost" icon={X} block onClick={() => setPanel({ kind: "member", m: panel.m })}>{strings.cancel}</Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
