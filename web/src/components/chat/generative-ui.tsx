"use client";

import { useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { StatusBanner } from "@/components/ui";
import { useChatT } from "./chat-t";
import { AskContext, oydinLibrary, ToolValuesContext } from "./openui-library";

/** Рисует OpenUI Lang (ответ чата или спека инструмента) компонентами кита. */
export function GenerativeUI({
  spec,
  onAsk,
  values,
  onValuesChange,
}: {
  spec: string;
  onAsk?: (prompt: string) => void;
  values?: Record<string, number>;
  onValuesChange?: (values: Record<string, number>) => void;
}) {
  const t = useChatT();
  const [failed, setFailed] = useState(false);
  const tool = values && onValuesChange ? { values, onChange: onValuesChange } : null;
  if (failed) return <StatusBanner kind="warning" title={t("chat.ui.renderError")} />;
  return (
    <AskContext.Provider value={onAsk ?? null}>
      <ToolValuesContext.Provider value={tool}>
        <Renderer
          response={spec}
          library={oydinLibrary}
          onError={(errors) => setFailed(errors.some((e) => e.severity !== "warning"))}
        />
      </ToolValuesContext.Provider>
    </AskContext.Provider>
  );
}
