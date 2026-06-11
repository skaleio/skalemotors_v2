import { format, parseISO } from "date-fns";

export type LeadDelegationInput = {
  assigned_to?: string | null;
  assigned_at?: string | null;
  assigned_user?: { full_name?: string | null; email?: string | null } | null;
};

/** Texto «LEAD DELEGADO EL … A LAS … A …»; null si no hay delegación registrada. */
export function formatLeadDelegationCaption(lead: LeadDelegationInput): string | null {
  const assigneeId = lead.assigned_to?.trim();
  const assignedAt = lead.assigned_at?.trim();
  if (!assigneeId || !assignedAt) return null;

  const assigneeName =
    lead.assigned_user?.full_name?.trim()
    || lead.assigned_user?.email?.trim()
    || "vendedor";

  try {
    const dt = parseISO(assignedAt);
    const fecha = format(dt, "dd-MM-yyyy");
    const hora = format(dt, "HH:mm");
    return `LEAD DELEGADO EL ${fecha} A LAS ${hora} A ${assigneeName.toUpperCase()}`;
  } catch {
    return null;
  }
}
