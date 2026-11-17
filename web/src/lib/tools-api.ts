import { api, post } from "@/lib/api";
import type { AiReply } from "@/lib/types";

export type ToolKind =
  | "what_if_gap"
  | "unit_cost"
  | "break_even"
  | "payroll"
  | "loan"
  | "envelope_plan_fact"
  | "receivables_aging"
  | "custom";

/** OpenUI Lang: `spec` калькулятора и `ui` ответа чата — один формат (backend/ai/ui.py). */
export interface ToolTemplate {
  title: string;
  kind: ToolKind;
  spec: string;
}

export interface SavedTool extends ToolTemplate {
  id: number;
  pinned: boolean;
  values: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export type AiReplyWithUi = AiReply & { ui?: string | null };

export const listTools = () => api<SavedTool[]>("/tools/");
export const getTool = (id: number) => api<SavedTool>(`/tools/${id}/`);
export const listTemplates = (lang: string) => api<ToolTemplate[]>(`/tools/templates/?lang=${encodeURIComponent(lang)}`);
export const createTool = (body: { title: string; kind: ToolKind; spec: string; values?: Record<string, number>; pinned?: boolean }) =>
  post<SavedTool>("/tools/", body);
export const updateTool = (id: number, body: Partial<Pick<SavedTool, "title" | "pinned" | "values">>) =>
  api<SavedTool>(`/tools/${id}/`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteTool = (id: number) => api<{ ok: true }>(`/tools/${id}/`, { method: "DELETE" });
export const generateTool = (body: { prompt: string; kind?: ToolKind; lang?: string }) => post<ToolTemplate>("/ai/tools/generate/", body);
