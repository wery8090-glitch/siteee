import { createHash } from "node:crypto";
import { isCreatorEmail } from "../shared/creators";

type AutoReply = { id: number; name: string; keywords: string[]; body: string; enabled: boolean; priority: number; created_at?: string; updated_at?: string };
type Profile = { id: number; open_id: string; email?: string | null };

const SUPABASE_URL = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "https://rsbcqzeyiazogktztubu.supabase.co").replace(/\/$/, "");
function headers() { const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY; if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured"); return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }
async function rest<T>(path: string, init: RequestInit = {}) { const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(`SUPABASE_${response.status}`); return body as T; }

export async function getAutoReplyTemplates() {
  return rest<AutoReply[]>("support_auto_reply_templates?select=*&order=priority.asc,created_at.asc&limit=200");
}
export async function createAutoReplyTemplate(input: { name: string; keywords: string[]; body: string; priority: number }) {
  const rows = await rest<AutoReply[]>("support_auto_reply_templates", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name: input.name, keywords: input.keywords, body: input.body, priority: input.priority, enabled: true }) });
  return rows[0] ?? null;
}
export async function updateAutoReplyTemplate(input: { id: number; name?: string; keywords?: string[]; body?: string; enabled?: boolean; priority?: number }) {
  const { id, ...changes } = input;
  const rows = await rest<AutoReply[]>(`support_auto_reply_templates?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }) });
  return rows[0] ?? null;
}
export async function deleteAutoReplyTemplate(id: number) {
  await rest(`support_auto_reply_templates?id=eq.${id}`, { method: "DELETE" });
  return true;
}

function matches(template: AutoReply, text: string) {
  const normalized = text.toLowerCase();
  return template.enabled && template.keywords.some(keyword => keyword.trim() && normalized.includes(keyword.trim().toLowerCase()));
}
async function botOpenId() {
  const rows = await rest<Profile[]>("profiles?select=id,open_id,email&limit=500");
  return rows.find(row => isCreatorEmail(row.email))?.open_id ?? null;
}
export async function maybeSendAutoReply(input: { ticketId: number; text: string }) {
  const templates = await getAutoReplyTemplates();
  const template = templates.find(item => matches(item, input.text));
  if (!template) return null;
  const authorOpenId = await botOpenId();
  if (!authorOpenId) return null;
  const body = `БОТ ПОДДЕРЖКИ: ${template.body}`;
  await rest("support_messages", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ticket_id: input.ticketId, author_open_id: authorOpenId, body, internal: false }) });
  await rest(`support_tickets?id=eq.${input.ticketId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "pending", updated_at: new Date().toISOString() }) });
  return { templateId: template.id, body };
}

export async function directIssueSubscription(input: { userId: number; planId: number; startsAt: Date; endsAt: Date; provider: "FunPay" | "Telegram" | "Manual"; adminNote?: string }) {
  const rows = await rest<Array<{ id: number }>>("subscriptions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: input.userId, plan_id: input.planId, status: "active", starts_at: input.startsAt.toISOString(), ends_at: input.endsAt.toISOString(), provider: input.provider, admin_note: input.adminNote ?? null }) });
  return rows[0]?.id ? Number(rows[0].id) : null;
}
export async function directUpdateSubscription(input: { id: number; planId: number; startsAt: Date; endsAt: Date; provider: "FunPay" | "Telegram" | "Manual"; adminNote?: string }) {
  const rows = await rest<Array<{ id: number }>>(`subscriptions?id=eq.${input.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ plan_id: input.planId, starts_at: input.startsAt.toISOString(), ends_at: input.endsAt.toISOString(), provider: input.provider, admin_note: input.adminNote ?? null, status: "active" }) });
  return rows.length > 0;
}
export async function directExtendSubscription(id: number, days: number) {
  const rows = await rest<Array<{ ends_at: string }>>(`subscriptions?id=eq.${id}&select=ends_at&limit=1`);
  if (!rows[0]) return false;
  const next = new Date(Math.max(Date.parse(rows[0].ends_at), Date.now()) + days * 86_400_000).toISOString();
  const updated = await rest<Array<{ id: number }>>(`subscriptions?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ends_at: next, status: "active" }) });
  return updated.length > 0;
}
export async function directRevokeSubscription(id: number) {
  const updated = await rest<Array<{ id: number }>>(`subscriptions?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "cancelled" }) });
  return updated.length > 0;
}
export async function directRedeemSubscriptionKey(input: { key: string; userId: number }) {
  const keyHash = createHash("sha256").update(input.key.trim().toUpperCase()).digest("hex");
  const rows = await rest<Array<{ id: number; plan_id: number; duration_days: number; max_activations: number; used_activations: number; expires_at: string; status: string; plan?: { id: number; name: string; slug: string } }>>(`subscription_keys?select=*,plan:subscription_plans(id,name,slug)&key_hash=eq.${keyHash}&status=eq.available&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
  const key = rows[0];
  if (!key || key.used_activations >= key.max_activations) return null;
  const now = new Date();
  const updated = await rest<Array<{ id: number }>>(`subscription_keys?id=eq.${key.id}&status=eq.available&used_activations=lt.${key.max_activations}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ used_activations: key.used_activations + 1, redeemed_by_user_id: input.userId, redeemed_at: now.toISOString(), status: key.used_activations + 1 >= key.max_activations ? "redeemed" : "available" }) });
  if (!updated.length) return null;
  const subscriptionId = await directIssueSubscription({ userId: input.userId, planId: key.plan_id, startsAt: now, endsAt: new Date(now.getTime() + key.duration_days * 86_400_000), provider: "Manual", adminNote: `Redeemed subscription key ${key.id}` });
  return subscriptionId ? { subscriptionId, plan: key.plan, durationDays: key.duration_days, usedActivations: key.used_activations + 1, maxActivations: key.max_activations } : null;
}
