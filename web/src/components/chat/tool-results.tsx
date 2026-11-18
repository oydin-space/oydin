"use client";

import { Check } from "lucide-react";
import { Icon } from "@/components/ui";
import { useChatT, type ChatKey } from "./chat-t";

const KNOWN: Record<string, true> = { get_forecast: true, search_transactions: true, get_analytics: true, get_orders: true, remember: true, forget: true, get_context: true, web_search: true, research: true };

/** Ключ копирайта по имени инструмента; внешние коннекторы (`ext_*`) и неизвестные имена — общие формулировки. */
function toolKey(name: string): ChatKey {
  if (KNOWN[name]) return `chat.toolResult.${name}` as ChatKey;
  return (name.startsWith("ext_") ? "chat.toolResult.external" : "chat.toolResult.unknown") as ChatKey;
}

/** Что помощник проверил перед ответом: человеческие фразы вместо имён инструментов. */
export function ToolResults({ tools }: { tools: string[] }) {
  const t = useChatT();
  const unique = [...new Set(tools.map(toolKey))];
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("chat.toolResult.unknown")}>
      {unique.map((key) => (
        <li key={key} className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-small text-ink">
          <Icon icon={Check} size={16} />
          {t(key)}
        </li>
      ))}
    </ul>
  );
}
