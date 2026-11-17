"use client";

import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Badge, Button, EmptyState, ErrorState, Input, ListGroup, ListRow, PageHeader, SegmentedControl, Sheet, SkeletonList } from "@/components/ui";
import { changeMemberRole, errorText, inviteMember, listMembers, removeMember, type TeamMember } from "@/lib/auth-api";
import type { Role } from "@/lib/types";
import { ROLES, roleLabel } from "./roles";

const strings = {
  title: "Команда",
  hint: "Кто видит бизнес и что может делать.",
  invite: "Пригласить",
  inviteTitle: "Пригласить участника",
  email: "Электронная почта",
  role: "Роль",
  send: "Отправить приглашение",
  roleHints: { owner: "Владелец: всё, включая команду.", accountant: "Бухгалтер: видит всё, ведёт операции и обязательства.", seller: "Продавец: только свои записи, без остатков." } satisfies Record<Role, string>,
  invited: "Приглашён",
  you: "Вы",
  empty: "Пока только вы",
  emptyHint: "Пригласите бухгалтера или продавца по почте.",
  ownerOnly: "Раздел только для владельца",
  ownerOnlyHint: "Попросите владельца изменить состав команды.",
  save: "Сохранить роль",
  remove: "Удалить из команды",
  confirmRemove: (who: string) => `Удалить ${who} из команды? Доступ пропадёт сразу.`,
  confirm: "Да, удалить",
  cancel: "Отмена",
  loadError: "не удалось загрузить команду",
  generic: "Не получилось. Попробуйте ещё раз.",
  errors: {
    last_owner: "Нельзя убрать последнего владельца. Сначала назначьте другого.",
    already_member: "Этот человек уже в команде.",
    http_403: "Менять команду может только владелец.",
    http_404: "Участник не найден. Обновите список.",
    http_400: "Проверьте почту и роль.",
  } as Record<string, string>,
};

type Panel = { kind: "invite" } | { kind: "member"; m: TeamMember } | { kind: "confirm"; m: TeamMember } | null;
const who = (m: TeamMember) => m.name || m.email || m.invited_email || "";

export function TeamView() {
  const { user } = useSession();
  const businessId = user?.active_business_id ?? null;
  const isOwner = user?.role === "owner";
  const [items, setItems] = useState<TeamMember[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("accountant");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const label = (m: TeamMember) => `${roleLabel(m.role)}${m.user_id === user?.id ? ` · ${strings.you}` : ""}`;
  const roleOptions = ROLES.map((r) => ({ value: r, label: roleLabel(r) }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader title={strings.title} hint={strings.hint} actions={<Button icon={UserPlus} onClick={() => open({ kind: "invite" })}>{strings.invite}</Button>} />
      {loadFailed ? (
        <ErrorState message={strings.loadError} onRetry={() => { setLoadFailed(false); void load(); }} />
      ) : !items ? (
        <SkeletonList rows={3} />
      ) : items.length <= 1 && items.every((m) => m.user_id === user?.id) ? (
        <>
          <ListGroup>{items.map((m) => <ListRow key={m.id} title={who(m)} subtitle={label(m)} />)}</ListGroup>
          <EmptyState title={strings.empty} hint={strings.emptyHint} />
        </>
      ) : (
        <ListGroup>
          {items.map((m) => (
            <ListRow
              key={m.id}
              title={who(m)}
              subtitle={m.email && m.email !== who(m) ? `${m.email} · ${label(m)}` : label(m)}
              status={m.status === "invited" ? <Badge tone="caution">{strings.invited}</Badge> : undefined}
              onClick={() => open({ kind: "member", m })}
            />
          ))}
        </ListGroup>
      )}

      <Sheet
        open={panel !== null}
        onOpenChange={(v) => !v && setPanel(null)}
        title={panel?.kind === "invite" ? strings.inviteTitle : panel ? who(panel.m) : ""}
        description={panel?.kind === "confirm" ? strings.confirmRemove(who(panel.m)) : undefined}
      >
        {panel?.kind === "invite" ? (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void run(() => inviteMember(id, email.trim(), role)); }}>
            <Input type="email" label={strings.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
            <SegmentedControl label={strings.role} value={role} onValueChange={setRole} options={roleOptions} />
            <p className="text-caption text-muted-foreground">{strings.roleHints[role]}</p>
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button type="submit" block loading={busy}>{strings.send}</Button>
          </form>
        ) : panel?.kind === "member" ? (
          <div className="flex flex-col gap-4">
            <SegmentedControl label={strings.role} value={role} onValueChange={setRole} options={roleOptions} />
            <p className="text-caption text-muted-foreground">{strings.roleHints[role]}</p>
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button block loading={busy} disabled={role === panel.m.role} onClick={() => void run(() => changeMemberRole(id, panel.m.id, role))}>{strings.save}</Button>
            <Button variant="destructive" block onClick={() => { setError(null); setPanel({ kind: "confirm", m: panel.m }); }}>{strings.remove}</Button>
          </div>
        ) : panel?.kind === "confirm" ? (
          <div className="flex flex-col gap-3">
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button variant="destructive" block loading={busy} onClick={() => void run(() => removeMember(id, panel.m.id))}>{strings.confirm}</Button>
            <Button variant="ghost" block onClick={() => setPanel({ kind: "member", m: panel.m })}>{strings.cancel}</Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
