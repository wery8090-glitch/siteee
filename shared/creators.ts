export const CREATOR_EMAILS = ["speedyboom333@gmail.com", "wery8090@gmail.com"] as const;

export function isCreatorEmail(email?: string | null) {
  return Boolean(email && CREATOR_EMAILS.includes(email.trim().toLowerCase() as (typeof CREATOR_EMAILS)[number]));
}

export const CREATOR_UID = 0;
