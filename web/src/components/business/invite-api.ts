import { api, post } from "@/lib/api";
import type { Me } from "@/lib/types";

export type InviteRole = "accountant" | "seller";
export type InviteStatus = "active" | "expired" | "revoked" | "used_up";

export interface Invite {
  id: number;
  code: string;
  role: InviteRole;
  expires_at: string;
  max_uses: number;
  uses: number;
  status: InviteStatus;
  created_at: string;
}

export interface InvitePreview {
  business_name: string;
  role: InviteRole;
  expires_at: string;
}

export const listInvites = (businessId: number) => api<{ items: Invite[] }>(`/businesses/${businessId}/invites/`).then((r) => r.items);
export const createInvite = (businessId: number, body: { role: InviteRole; expires_in_hours: number; max_uses: number }) =>
  post<Invite>(`/businesses/${businessId}/invites/`, body);
export const revokeInvite = (businessId: number, inviteId: number) =>
  api<void>(`/businesses/${businessId}/invites/${inviteId}/`, { method: "DELETE" });
export const previewInvite = (code: string) => api<InvitePreview>(`/invites/${encodeURIComponent(code)}/`);
export const acceptInvite = (code: string) => post<Me>(`/invites/${encodeURIComponent(code)}/accept/`);

export const inviteUrl = (code: string) => `${window.location.origin}/join/${code}`;
export const telegramShareUrl = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
