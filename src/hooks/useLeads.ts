import { useState, useEffect } from 'react'
import { leadService } from '@/lib/services/leads'
import type { Database } from '@/lib/types/database'

type Lead = Database['public']['Tables']['leads']['Row']

interface UseLeadsOptions {
  assignedTo?: string
  branchId?: string
  status?: string
  source?: string
  search?: string
  enabled?: boolean
}

export function useLeads(options: UseLeadsOptions = {}) {
  const { assignedTo, branchId, status, source, search, enabled = true } = options
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const fetchLeads = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await leadService.getAll({
          assignedTo,
          branchId,
          status,
          source,
          search
        })
        setLeads(data)
      } catch (err) {
        setError(err as Error)
        console.error('Error fetching leads:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeads()
  }, [assignedTo, branchId, status, source, search, enabled])

  return { 
    leads, 
    loading, 
    error, 
    refetch: () => {
      setLoading(true)
      leadService.getAll({ assignedTo, branchId, status, source, search })
        .then(setLeads)
        .catch(setError)
        .finally(() => setLoading(false))
    }
  }
}


