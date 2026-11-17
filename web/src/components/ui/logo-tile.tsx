"use client";

import { useKitT, type KitKey } from "./kit-t";
import Image from "next/image";
import { Globe, Table2, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

/** Реальные логотипы из /public/logos. Нет файла — нейтральная монограмма, никаких выдуманных знаков. */
const FILES: Record<string, { src: string; wide?: boolean; w: number; h: number }> = {
  telegram: { src: "/logos/telegram.svg", w: 240, h: 240 },
  hamkorbank: { src: "/logos/hamkorbank.png", w: 2237, h: 2237 },
  "google-sheets": { src: "/logos/google-sheets.svg", w: 192, h: 192 },
  google: { src: "/logos/google.png", w: 128, h: 128 },
  uzum: { src: "/logos/uzum.svg", wide: true, w: 160, h: 40 },
  moysklad: { src: "/logos/moysklad.svg", wide: true, w: 160, h: 40 },
  faktura: { src: "/logos/faktura.png", w: 1079, h: 1079 },
  didox: { src: "/logos/didox.png", w: 192, h: 192 },
  "1c": { src: "/logos/1c.png", w: 230, h: 174 },
  payme: { src: "/logos/payme.png", w: 180, h: 180 },
};

const GLYPHS = { csv: Table2, api: Globe, webhooks: Webhook } as const;

export type LogoKey = keyof typeof FILES | keyof typeof GLYPHS | (string & {});

export function LogoMark({ logo, name, size = 40 }: { logo: LogoKey; name: string; size?: number }) {
  const file = FILES[logo];
  const Glyph = GLYPHS[logo as keyof typeof GLYPHS];
  return (
    <span className="inline-grid shrink-0 place-items-center overflow-hidden rounded-control border border-border bg-white p-1.5 text-neutral-900" style={{ width: file?.wide ? size * 2.4 : size, height: size }}>
      {file ? (
        <Image src={file.src} alt="" width={file.w} height={file.h} unoptimized className="size-full object-contain" />
      ) : Glyph ? (
        <Glyph className="size-3/5" aria-hidden="true" />
      ) : (
        <span className="text-small font-semibold" aria-hidden="true">
          {name.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

export type IntegrationStatus = "connected" | "available" | "coming-soon";

const STATUS: Record<IntegrationStatus, { tone: "positive" | "neutral" | "coming-soon"; key: KitKey }> = {
  connected: { tone: "positive", key: "kit.integration.connected" },
  available: { tone: "neutral", key: "kit.integration.available" },
  "coming-soon": { tone: "coming-soon", key: "kit.integration.coming-soon" },
};

export interface LogoTileProps {
  logo: LogoKey;
  name: string;
  description?: string;
  status: IntegrationStatus;
  statusLabel?: string;
  onClick?: () => void;
  className?: string;
}

/** Карточка интеграции. «Скоро» — неактивна и не выглядит как рабочий connect-flow. */
export function LogoTile({ logo, name, description, status, statusLabel, onClick, className }: LogoTileProps) {
  const t = useKitT();
  const s = STATUS[status];
  const soon = status === "coming-soon";
  const content = (
    <>
      <LogoMark logo={logo} name={name} size={48} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-body font-medium">{name}</span>
        {description ? <span className="truncate text-small text-muted-foreground">{description}</span> : null}
      </span>
      <Badge tone={s.tone}>{statusLabel ?? t(s.key)}</Badge>
    </>
  );
  const base = cn("flex min-h-row w-full items-center gap-3 rounded-card border border-border bg-card p-3", className);
  if (soon || !onClick) return <div className={cn(base, soon && "opacity-80")}>{content}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(base, "state-layer press focus-ring")}>
      {content}
    </button>
  );
}
