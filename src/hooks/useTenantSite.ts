import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/contexts/AuthContext'
import { tenantSiteService, type TenantSite } from '@/lib/services/tenantSite'

const SITE_KEY = ['tenant_site']
const DOMAINS_KEY = ['tenant_domains']

export function useTenantSite() {
  return useQuery({
    queryKey: SITE_KEY,
    queryFn: () => tenantSiteService.getMySite(),
  })
}

export function useTenantDomains() {
  return useQuery({
    queryKey: DOMAINS_KEY,
    queryFn: () => tenantSiteService.listMyDomains(),
  })
}

export function useCreateTenantSite() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: () => tenantSiteService.createMySite(user?.tenant_id),
    onSuccess: (site) => {
      queryClient.setQueryData(SITE_KEY, site)
      queryClient.invalidateQueries({ queryKey: SITE_KEY })
    },
  })
}

export function useUpdateTenantSite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<TenantSite>) => tenantSiteService.updateMySite(patch),
    onSuccess: (site) => {
      queryClient.setQueryData(SITE_KEY, site)
      queryClient.invalidateQueries({ queryKey: SITE_KEY })
    },
  })
}
