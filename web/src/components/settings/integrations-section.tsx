"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { LogoTile } from "@/components/ui";
import { fetchProviders } from "@/lib/auth-api";
import { fetchTelegramLink } from "@/lib/settings-api";
import { TelegramDialog } from "./telegram-dialog";
import { useResource } from "./use-resource";
import { type SKey, useST } from "./use-st";

const SOON: { logo: string; name: SKey; desc: SKey }[] = [
  { logo: "payme", name: "settings.integrations.payme", desc: "settings.integrations.paymentDesc" },
  { logo: "click", name: "settings.integrations.click", desc: "settings.integrations.paymentDesc" },
  { logo: "uzum", name: "settings.integrations.uzum", desc: "settings.integrations.salesDesc" },
  { logo: "moysklad", name: "settings.integrations.moysklad", desc: "settings.integrations.salesDesc" },
  { logo: "billz", name: "settings.integrations.billz", desc: "settings.integrations.salesDesc" },
  { logo: "didox", name: "settings.integrations.didox", desc: "settings.integrations.docsDesc" },
  { logo: "faktura", name: "settings.integrations.faktura", desc: "settings.integrations.docsDesc" },
  { logo: "banks", name: "settings.integrations.banks", desc: "settings.integrations.banksDesc" },
];

const DATA_PATH = "/app/settings/data";

export function IntegrationsSection() {
  const { t } = useST();
  const router = useRouter();
  const { user } = useSession();
  const telegram = useResource(fetchTelegramLink);
  const providers = useResource(fetchProviders);
  const [tgOpen, setTgOpen] = useState(false);
  const owner = user?.role === "owner";

  const label = {
    connected: t("settings.integrations.status.connected"),
    available: t("settings.integrations.status.available"),
    soon: t("settings.integrations.status.soon"),
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="text-small text-muted-foreground">{t("settings.integrations.hint")}</p>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="int-now">
        <h2 id="int-now" className="text-title font-semibold">{t("settings.integrations.available")}</h2>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <LogoTile
            logo="telegram"
            name={t("settings.integrations.telegram")}
            description={t("settings.integrations.telegramDesc")}
            status={telegram.data?.linked ? "connected" : "available"}
            statusLabel={telegram.data?.linked ? label.connected : label.available}
            onClick={() => setTgOpen(true)}
          />
          <LogoTile logo="csv" name={t("settings.integrations.csv")} description={t("settings.integrations.csvDesc")} status="available" statusLabel={label.available} onClick={() => router.push(DATA_PATH)} />
          <LogoTile logo="1c" name={t("settings.integrations.onec")} description={t("settings.integrations.onecDesc")} status="available" statusLabel={label.available} onClick={() => router.push(DATA_PATH)} />
          {owner ? (
            <LogoTile logo="api" name={t("settings.integrations.api")} description={t("settings.integrations.apiDesc")} status="available" statusLabel={label.available} onClick={() => router.push("/app/settings/developer")} />
          ) : null}
          {providers.data?.google ? (
            <LogoTile logo="google-sheets" name={t("settings.integrations.sheets")} description={t("settings.integrations.sheetsDesc")} status="available" statusLabel={label.available} onClick={() => router.push(DATA_PATH)} />
          ) : null}
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="int-soon">
        <h2 id="int-soon" className="text-title font-semibold">{t("settings.integrations.soon")}</h2>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          {SOON.map((s) => (
            <LogoTile key={s.logo} logo={s.logo} name={t(s.name)} description={t(s.desc)} status="coming-soon" statusLabel={label.soon} />
          ))}
        </div>
      </section>

      <TelegramDialog open={tgOpen} onOpenChange={setTgOpen} state={telegram.data} loading={telegram.loading} error={telegram.error} reload={telegram.reload} />
    </div>
  );
}
