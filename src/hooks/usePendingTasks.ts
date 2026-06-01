import { dedupePendingTasks } from '@/lib/pendingTaskDedupe'
import { canSyncStaleAlerts, pendingTasksService, syncPendingTasksIfDue } from '@/lib/services/pendingTasks'
import { supabase } from '@/lib/supabase'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { Database } from '@/lib/types/database'

export type PendingTask = Database['public']['Tables']['pending_tasks']['Row']
const ENABLE_PENDING_TASK_SYNC_RPCS = false

type UsePendingTasksOptions = {
  branchId?: string | null
  tenantId?: string | null
  role?: string | null
  userId?: string | null
}

// Backward compat: acepta un string (branchId) como en la versión anterior,
// o un objeto con contexto completo del usuario (branchId + tenantId + role + userId).
type UsePendingTasksInput = string | null | undefined | UsePendingTasksOptions

function pendingTasksQueryKey(opts: UsePendingTasksOptions) {
  const { branchId, tenantId, role, userId } = opts
  const isAdminWide = role === 'admin' || role === 'jefe_jefe'
  return ['pending-tasks', { branchId, tenantId, role, userId, scope: isAdminWide ? 'tenant' : 'branch' }] as const
}

async function fetchPendingTasks(opts: UsePendingTasksOptions): Promise<PendingTask[]> {
  const { branchId, tenantId, role, userId } = opts
  const isJefeJefe = role === 'jefe_jefe'
  const isAdminWide = role === 'admin' || isJefeJefe
  const enabled = isAdminWide ? !!tenantId : !!branchId

  if (!enabled) return []

  if (ENABLE_PENDING_TASK_SYNC_RPCS) {
    await supabase.rpc('sync_lead_reminders_to_pending_tasks', { ventana_horas: 48 }).then(({ error }) => {
      const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
      if (error && !rpcNotFound) console.warn('sync_lead_reminders_to_pending_tasks:', error.message)
    })
    await supabase.rpc('sync_old_inventory_vehicles_to_pending_tasks', { dias_inventario: 45, dias_sin_modificar: 30 }).then(({ error }) => {
      const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
      if (error && !rpcNotFound) console.warn('sync_old_inventory_vehicles_to_pending_tasks:', error.message)
    })
  }

  let q = supabase
    .from('pending_tasks')
    .select('*')
    .is('completed_at', null)
    .order('due_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })

  if (isAdminWide && tenantId) {
    q = q.eq('tenant_id', tenantId)
  } else if (branchId) {
    q = q.eq('branch_id', branchId)
  } else {
    return []
  }

  if (!isJefeJefe && userId) {
    q = q.or(`assigned_to.is.null,assigned_to.eq.${userId}`)
  }

  const { data, error } = await q
  if (error) throw error
  const list = dedupePendingTasks(data ?? [])
  const order: Record<string, number> = { urgent: 0, today: 1, later: 2 }
  return [...list].sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2))
}

export function usePendingTasks(input: UsePendingTasksInput) {
  const queryClient = useQueryClient()

  const opts: UsePendingTasksOptions =
    typeof input === 'string' || input == null
      ? { branchId: input ?? null }
      : input

  const { branchId, tenantId, role } = opts
  const isAdminWide = role === 'admin' || role === 'jefe_jefe'
  const enabled = isAdminWide ? !!tenantId : !!branchId
  const queryKey = pendingTasksQueryKey(opts)
  const syncScopeRef = useRef<string | null>(null)

  const query = useQuery({
    queryKey,
    queryFn: () => fetchPendingTasks(opts),
    enabled,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData: PendingTask[] | undefined) => previousData ?? [],
  })

  useEffect(() => {
    if (!enabled || !canSyncStaleAlerts(role)) return
    const scope = `${tenantId ?? ''}:${branchId ?? ''}:${role ?? ''}`
    if (syncScopeRef.current === scope) return
    syncScopeRef.current = scope

    void (async () => {
      await syncPendingTasksIfDue()
      await queryClient.invalidateQueries({ queryKey: ['pending-tasks'] })
    })()
  }, [enabled, tenantId, branchId, role, queryClient])

  const urgentCount = (query.data ?? []).filter((t) => t.priority === 'urgent').length
  const urgentTasks = (query.data ?? []).filter((t) => t.priority === 'urgent')
  const todayTasks = (query.data ?? []).filter((t) => t.priority === 'today')
  const laterTasks = (query.data ?? []).filter((t) => t.priority === 'later')

  return {
    tasks: query.data ?? [],
    urgentCount,
    urgentTasks,
    todayTasks,
    laterTasks,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    queryClient,
  }
}

export function useCompletePendingTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => pendingTasksService.complete(taskId),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['pending-tasks'] })
      const snapshots = queryClient.getQueriesData<PendingTask[]>({ queryKey: ['pending-tasks'] })

      snapshots.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData(key, data.filter((t) => t.id !== taskId))
        }
      })

      return { snapshots }
    },
    onError: (_err, _taskId, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['pending-tasks-completed'] })
    },
  })
}

// Tareas completadas en los últimos N días. Hook separado del principal para no
// inflar el caché del listado activo y poder consultarlo solo cuando se abre el tab.
export function useCompletedPendingTasks(
  input: UsePendingTasksInput,
  options: { days?: number; enabled?: boolean } = {},
) {
  const opts: UsePendingTasksOptions =
    typeof input === 'string' || input == null
      ? { branchId: input ?? null }
      : input

  const { branchId, tenantId, role, userId } = opts
  const isJefeJefe = role === 'jefe_jefe'
  const isAdminWide = role === 'admin' || isJefeJefe
  const days = options.days ?? 30

  const baseEnabled = isAdminWide ? !!tenantId : !!branchId
  const enabled = baseEnabled && (options.enabled ?? true)

  const query = useQuery({
    queryKey: ['pending-tasks-completed', { branchId, tenantId, role, userId, days, scope: isAdminWide ? 'tenant' : 'branch' }],
    queryFn: async (): Promise<PendingTask[]> => {
      if (!enabled) return []
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      let q = supabase
        .from('pending_tasks')
        .select('*')
        .not('completed_at', 'is', null)
        .gte('completed_at', since)
        .order('completed_at', { ascending: false })
        .limit(200)

      if (isAdminWide && tenantId) {
        q = q.eq('tenant_id', tenantId)
      } else if (branchId) {
        q = q.eq('branch_id', branchId)
      } else {
        return []
      }

      if (!isJefeJefe && userId) {
        q = q.or(`assigned_to.is.null,assigned_to.eq.${userId}`)
      }

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled,
    staleTime: 60 * 1000,
    placeholderData: (previousData: PendingTask[] | undefined) => previousData ?? [],
  })

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
