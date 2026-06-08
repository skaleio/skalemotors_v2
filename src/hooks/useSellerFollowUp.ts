import { useAuth } from '@/contexts/AuthContext'
import { leadService } from '@/lib/services/leads'
import {
  sellerFollowUpService,
  type SellerFollowUpPeriod,
  type SellerFollowUpCheckRow,
  type SellerFollowUpNoteRow,
} from '@/lib/services/sellerFollowUp'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const ACTIVE_LEAD_EXCLUDED = new Set(['vendido', 'perdido', 'cancelado'])

function isActiveLeadStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase()
  return !ACTIVE_LEAD_EXCLUDED.has(s)
}

function monthRange(month: Date) {
  const y = month.getFullYear()
  const m = month.getMonth()
  const fromDate = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const toDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { fromDate, toDate }
}

export function sellerFollowUpMonthQueryKey(month: Date) {
  const { fromDate, toDate } = monthRange(month)
  return ['seller-follow-up', 'month', fromDate, toDate] as const
}

export function sellerFollowUpNotesQueryKey(month: Date) {
  const { fromDate, toDate } = monthRange(month)
  return ['seller-follow-up', 'notes', fromDate, toDate] as const
}

export function filterChecksForDate(
  rows: SellerFollowUpCheckRow[],
  followUpDate: string,
): SellerFollowUpCheckRow[] {
  return rows.filter((row) => row.follow_up_date === followUpDate)
}

export function filterNotesForDate(
  rows: SellerFollowUpNoteRow[],
  followUpDate: string,
): SellerFollowUpNoteRow[] {
  return rows.filter((row) => row.follow_up_date === followUpDate)
}

export function useSellerFollowUpMonthChecks(month: Date, enabled = true) {
  const { fromDate, toDate } = monthRange(month)

  return useQuery({
    queryKey: sellerFollowUpMonthQueryKey(month),
    enabled,
    queryFn: () => sellerFollowUpService.listForDateRange({ fromDate, toDate }),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useSellerFollowUpMonthNotes(month: Date, enabled = true) {
  const { fromDate, toDate } = monthRange(month)

  return useQuery({
    queryKey: sellerFollowUpNotesQueryKey(month),
    enabled,
    queryFn: () => sellerFollowUpService.listNotesForDateRange({ fromDate, toDate }),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  })
}

export type SellerFollowUpLeadSummary = {
  id: string
  full_name: string | null
  status: string | null
  assigned_to: string | null
  assigned_user?: {
    id: string
    full_name: string | null
    email: string | null
    crm_color?: string | null
  } | null
}

export function useSellerFollowUpLeads(enabled = true) {
  return useQuery({
    queryKey: ['seller-follow-up', 'active-leads'],
    enabled,
    queryFn: async () => {
      const rows = await leadService.listActiveAssignedSummary()
      return (rows as SellerFollowUpLeadSummary[]).filter((l) =>
        isActiveLeadStatus(l.status),
      )
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useToggleSellerFollowUpCheck(month: Date) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const monthKey = sellerFollowUpMonthQueryKey(month)

  return useMutation({
    mutationFn: async (params: {
      followUpDate: string
      sellerUserId: string
      period: SellerFollowUpPeriod
      checked: boolean
    }) => {
      if (!user?.tenant_id || !user.id) {
        throw new Error('Sesión inválida')
      }
      return sellerFollowUpService.setChecked({
        tenantId: user.tenant_id,
        branchId: user.branch_id ?? null,
        followUpDate: params.followUpDate,
        sellerUserId: params.sellerUserId,
        period: params.period,
        checked: params.checked,
        checkedByUserId: user.id,
      })
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: monthKey })
      const previous = queryClient.getQueryData<SellerFollowUpCheckRow[]>(monthKey)

      queryClient.setQueryData<SellerFollowUpCheckRow[]>(monthKey, (prev) => {
        const rows = [...(prev ?? [])]
        const idx = rows.findIndex(
          (r) =>
            r.follow_up_date === vars.followUpDate &&
            r.seller_user_id === vars.sellerUserId &&
            r.period === vars.period,
        )
        const now = new Date().toISOString()
        const patch: SellerFollowUpCheckRow = {
          id: idx >= 0 ? rows[idx].id : `optimistic-${vars.sellerUserId}-${vars.period}`,
          tenant_id: user?.tenant_id ?? '',
          branch_id: user?.branch_id ?? null,
          follow_up_date: vars.followUpDate,
          seller_user_id: vars.sellerUserId,
          period: vars.period,
          checked: vars.checked,
          checked_by: vars.checked ? (user?.id ?? null) : null,
          checked_at: vars.checked ? now : null,
          created_at: idx >= 0 ? rows[idx].created_at : now,
          updated_at: now,
        }
        if (idx >= 0) rows[idx] = patch
        else rows.push(patch)
        return rows
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(monthKey, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['seller-follow-up', 'month'] })
    },
  })
}

export function useSaveSellerFollowUpNote(month: Date) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const notesKey = sellerFollowUpNotesQueryKey(month)

  return useMutation({
    mutationFn: async (params: {
      followUpDate: string
      sellerUserId: string
      note: string
    }) => {
      if (!user?.tenant_id || !user.id) {
        throw new Error('Sesión inválida')
      }
      return sellerFollowUpService.saveNote({
        tenantId: user.tenant_id,
        branchId: user.branch_id ?? null,
        followUpDate: params.followUpDate,
        sellerUserId: params.sellerUserId,
        note: params.note,
        updatedByUserId: user.id,
      })
    },
    onSuccess: (_row, vars) => {
      void queryClient.invalidateQueries({ queryKey: notesKey })
      void queryClient.invalidateQueries({ queryKey: ['seller-follow-up', 'notes'] })
    },
  })
}
