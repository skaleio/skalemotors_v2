import { canSyncStaleAlerts, syncPendingTasksIfDue } from '@/lib/services/pendingTasks'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/types/database'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export type Notification = Database['public']['Tables']['notifications']['Row']

const LIST_KEY = ['notifications'] as const

/** Un canal Realtime por usuario; varios componentes comparten la misma suscripción. */
const notificationRealtimeByUser = new Map<
  string,
  { channel: RealtimeChannel; refCount: number }
>()

function retainNotificationRealtime(userId: string, onChange: () => void): () => void {
  const existing = notificationRealtimeByUser.get(userId)
  if (existing) {
    existing.refCount += 1
    return () => releaseNotificationRealtime(userId)
  }

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe()

  notificationRealtimeByUser.set(userId, { channel, refCount: 1 })
  return () => releaseNotificationRealtime(userId)
}

function releaseNotificationRealtime(userId: string): void {
  const entry = notificationRealtimeByUser.get(userId)
  if (!entry) return
  entry.refCount -= 1
  if (entry.refCount <= 0) {
    void supabase.removeChannel(entry.channel)
    notificationRealtimeByUser.delete(userId)
  }
}

type UseNotificationsOptions = {
  userId: string | undefined
  role?: string | null
  limit?: number
  includeArchived?: boolean
  /** Ejecuta sync de leads/consignaciones/vehículos estancados al montar (throttle 5 min). */
  syncStaleAlerts?: boolean
}

export function useNotifications({
  userId,
  role,
  limit = 30,
  includeArchived = false,
  syncStaleAlerts = false,
}: UseNotificationsOptions) {
  const queryClient = useQueryClient()
  const staleSyncStartedRef = useRef(false)

  const query = useQuery({
    queryKey: [...LIST_KEY, userId, limit, includeArchived],
    queryFn: async (): Promise<Notification[]> => {
      if (!userId) return []
      let q = supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (!includeArchived) q = q.is('archived_at', null)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    placeholderData: (prev: Notification[] | undefined) => prev ?? [],
  })

  useEffect(() => {
    if (!syncStaleAlerts || !userId || !canSyncStaleAlerts(role)) return
    if (staleSyncStartedRef.current) return
    staleSyncStartedRef.current = true

    void (async () => {
      await syncPendingTasksIfDue()
      await queryClient.invalidateQueries({ queryKey: LIST_KEY })
    })()
  }, [syncStaleAlerts, userId, role, queryClient])

  // Realtime: INSERT/UPDATE sobre notifications del usuario (canal compartido por userId)
  useEffect(() => {
    if (!userId) return
    return retainNotificationRealtime(userId, () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
    })
  }, [userId, queryClient])

  const notifications = query.data ?? []
  const unreadCount = notifications.filter((n) => !n.read_at && !n.archived_at).length

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_user_id', userId)
        .is('read_at', null)
        .is('archived_at', null)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  })
}

export function useDismissNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ archived_at: new Date().toISOString(), read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  })
}
