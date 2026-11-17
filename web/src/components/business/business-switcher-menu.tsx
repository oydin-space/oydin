"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { BusinessSwitcher, Badge, Button, Input, ListGroup, ListRow, Sheet } from "@/components/ui";
import { useT } from "@/i18n";
import { createBusiness, errorText, setSegment, switchBusiness, type Segment } from "@/lib/auth-api";
import { roleLabel } from "./roles";
import { SegmentSelect } from "./segment-select";

/** Кнопка в шапке/боковой панели + лист со списком бизнесов и формой «Новый бизнес» (один лист, два состояния). */
export function BusinessSwitcherMenu({ className }: { className?: string }) {
  const t = useT();
  const { user, applyMe, refresh } = useSession();
  const strings = {
    title: t("biz.switch.title"),
    description: t("biz.switch.description"),
    current: t("biz.switch.current"),
    demo: t("biz.switch.demo"),
    newBusiness: t("biz.switch.new"),
    newTitle: t("biz.switch.newTitle"),
    name: t("biz.switch.name"),
    create: t("biz.switch.create"),
    back: t("biz.switch.back"),
    required: t("biz.switch.required"),
    pickSegment: t("biz.switch.pickSegment"),
    generic: t("biz.generic"),
    errors: { http_403: t("biz.switch.err.http_403"), http_400: t("biz.switch.err.http_400") } as Record<string, string>,
  };
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [segment, setSeg] = useState<Segment>();
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user?.business) return null;

  const close = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setCreating(false);
      setError(null);
      setTouched(false);
      setName("");
      setSeg(undefined);
    }
  };

  async function pick(id: number) {
    if (id === user?.active_business_id) return close(false);
    setBusy(true);
    setError(null);
    try {
      applyMe(await switchBusiness(id));
      close(false);
    } catch (e) {
      setError(errorText(e, strings.errors, strings.generic));
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !segment) return;
    setBusy(true);
    setError(null);
    try {
      const b = await createBusiness({ name: name.trim() });
      await setSegment(b.id, segment).catch(() => undefined);
      await refresh();
      close(false);
    } catch (err) {
      setError(errorText(err, strings.errors, strings.generic));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BusinessSwitcher name={user.business.name} role={roleLabel(t, user.role)} onClick={() => setOpen(true)} className={className} />
      <Sheet open={open} onOpenChange={close} title={creating ? strings.newTitle : strings.title} description={creating ? undefined : strings.description}>
        {creating ? (
          <form onSubmit={create} noValidate className="flex flex-col gap-4">
            <Input label={strings.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required error={touched && !name.trim() ? strings.required : undefined} />
            <SegmentSelect value={segment} onValueChange={setSeg} error={touched && !segment ? strings.pickSegment : undefined} />
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button type="submit" block loading={busy}>{strings.create}</Button>
            <Button variant="ghost" block onClick={() => { setCreating(false); setError(null); }}>{strings.back}</Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <ListGroup>
              {user.businesses.map((b) => (
                <ListRow
                    key={b.id}
                    title={b.name}
                    subtitle={roleLabel(t, b.role)}
                    status={b.id === user.active_business_id ? <Badge tone="positive" icon={<Check className="size-3" aria-hidden="true" />}>{strings.current}</Badge> : b.is_demo ? <Badge>{strings.demo}</Badge> : undefined}
                    onClick={busy ? undefined : () => void pick(b.id)}
                />
              ))}
            </ListGroup>
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button variant="secondary" icon={Plus} block onClick={() => setCreating(true)}>{strings.newBusiness}</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
