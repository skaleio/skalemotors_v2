import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export type LeadDelegationInput = {
  assigned_to?: string | null;
  assigned_at?: string | null;
  assigned_user?: { full_name?: string | null; email?: string | null } | null;
};

export type LeadDelegationDetail = {
  fecha: string;
  hora: string;
  vendedor: string;
  assignedAt: Date;
};

function parseLeadDelegationDetail(lead: LeadDelegationInput): LeadDelegationDetail | null {
  const assigneeId = lead.assigned_to?.trim();
  const assignedAt = lead.assigned_at?.trim();
  if (!assigneeId || !assignedAt) return null;

  const vendedor =
    lead.assigned_user?.full_name?.trim()
    || lead.assigned_user?.email?.trim()
    || "Vendedor";

  try {
    const assignedAtDate = parseISO(assignedAt);
    return {
      fecha: format(assignedAtDate, "dd-MM-yyyy"),
      hora: format(assignedAtDate, "HH:mm"),
      vendedor,
      assignedAt: assignedAtDate,
    };
  } catch {
    return null;
  }
}

/** Texto completo para tooltip / accesibilidad. */
export function formatLeadDelegationCaption(lead: LeadDelegationInput): string | null {
  const parts = parseLeadDelegationDetail(lead);
  if (!parts) return null;
  return `Delegado el ${parts.fecha} a las ${parts.hora} a ${parts.vendedor}`;
}

/** Kanban (admin): «delegado hace 17 horas». */
export function formatLeadDelegationRelative(lead: LeadDelegationInput): string | null {
  const parts = parseLeadDelegationDetail(lead);
  if (!parts) return null;
  const distance = formatDistanceToNow(parts.assignedAt, { addSuffix: true, locale: es });
  return `delegado ${distance}`;
}

export function getLeadDelegationDetail(lead: LeadDelegationInput): LeadDelegationDetail | null {
  return parseLeadDelegationDetail(lead);
}
