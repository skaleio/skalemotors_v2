import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/types/database'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export type Notification = Database['public']['Tables']['notifications']['Row']

const LIST_KEY = ['notifications'] as const

type UseNotificationsOptions = {
  userId: string | undefined
  limit?: number
  includeArchived?: boolean
}

export function useNotifications({ userId, limit = 30, includeArchived = false }: UseNotificationsOptions) {
  const queryClient = useQueryClient()

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

  // Realtime: INSERT/UPDATE sobre notifications del usuario
  useEffect(() => {
    if (!userId) return
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
        () => {
          queryClient.invalidateQueries({ queryKey: LIST_KEY })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
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
