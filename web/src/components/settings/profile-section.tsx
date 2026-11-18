"use client";

import { LogOut, Palette, Save, ScrollText, ShieldCheck, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Button, FeedbackNotice, Icon, Input, LanguageSwitcher, ListGroup, ListRow, PlainCard, SegmentedControl, Select, StatusBanner } from "@/components/ui";
import { logout, type Segment } from "@/lib/auth-api";
import { applyTheme, readTheme, type ThemeChoice, updateBusiness } from "@/lib/settings-api";
import { useST } from "./use-st";

const SEGMENTS: Segment[] = ["textile_print", "retail", "horeca", "marketplace_seller", "services"];
const THEMES: ThemeChoice[] = ["system", "light", "dark"];

function BusinessForm({ id, initialName, demo }: { id: number; initialName: string; demo: boolean }) {
  const { t, err } = useST();
  const { user, refresh } = useSession();
  const owner = user?.role === "owner";
  const [name, setName] = useState(initialName);
  const [segment, setSegment] = useState<Segment | "">("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = touched && !name.trim() ? t("settings.profile.nameRequired") : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      await updateBusiness(id, { name: name.trim(), ...(segment ? { segment } : {}) });
      await refresh();
      setDone(true);
    } catch (x) {
      setError(err(x));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlainCard title={<span className="inline-flex items-center gap-2"><Icon icon={Store} size={20} />{t("settings.profile.business")}</span>} description={t("settings.profile.businessHint")}>
      {demo ? (
        <StatusBanner kind="info" title={t("settings.profile.demo")}>
          {owner ? t("settings.profile.demoScope") : t("settings.profile.readOnly")}
        </StatusBanner>
      ) : null}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3" noValidate>
        <Input label={t("settings.profile.name")} value={name} onChange={(e) => setName(e.target.value)} error={nameError} required disabled={demo} />
        <Select
          label={t("settings.profile.segment")}
          placeholder={t("settings.profile.segmentPlaceholder")}
          value={segment}
          onValueChange={(v) => setSegment(SEGMENTS.find((s) => s === v) ?? "")}
          options={SEGMENTS.map((s) => ({ value: s, label: t(`settings.segment.${s}`) }))}
          disabled={demo}
        />
        {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
        {done ? <FeedbackNotice>{t("settings.profile.saved")}</FeedbackNotice> : null}
        <div>
          <Button type="submit" icon={Save} loading={saving} disabled={demo}>
            {t("settings.common.save")}
          </Button>
        </div>
      </form>
    </PlainCard>
  );
}

export function ProfileSection() {
  const { t } = useST();
  const { user } = useSession();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [leaving, setLeaving] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  async function leave() {
    setLeaving(true);
    setLogoutError(false);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLogoutError(true);
      setLeaving(false);
    }
  }

  const active = user?.businesses.find((b) => b.id === user.active_business_id);

  return (
    <div className="flex flex-col gap-4">
      <PlainCard title={<span className="inline-flex items-center gap-2"><Icon icon={Palette} size={20} />{t("settings.profile.appearance")}</span>}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("settings.profile.language")}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium">{t("settings.profile.theme")}</span>
            <SegmentedControl
              label={t("settings.profile.theme")}
              value={theme}
              onValueChange={(v) => {
                setTheme(v);
                applyTheme(v);
              }}
              options={THEMES.map((v) => ({ value: v, label: t(`settings.profile.theme.${v}`) }))}
            />
          </div>
        </div>
      </PlainCard>

      {user?.role === "owner" && user.business ? <BusinessForm key={user.business.id} id={user.business.id} initialName={user.business.name} demo={!!active?.is_demo} /> : null}

      <ListGroup header={t("settings.profile.legal")}>
        <ListRow title={t("settings.profile.privacy")} href="/privacy" chevron leading={<Icon icon={ShieldCheck} size={20} className="text-muted-foreground" />} />
        <ListRow title={t("settings.profile.terms")} href="/terms" chevron leading={<Icon icon={ScrollText} size={20} className="text-muted-foreground" />} />
      </ListGroup>

      {logoutError ? <FeedbackNotice kind="error">{t("settings.profile.logoutFailed")}</FeedbackNotice> : null}
      <div>
        <Button variant="secondary" icon={LogOut} loading={leaving} onClick={leave}>
          {t("settings.profile.logout")}
        </Button>
      </div>
    </div>
  );
}
