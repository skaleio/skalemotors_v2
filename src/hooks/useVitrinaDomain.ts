import { useMutation, useQueryClient } from '@tanstack/react-query'

import { vitrinaDomainApi, type VitrinaDnsRecord } from '@/lib/services/vitrinaDomainApi'

const DOMAINS_KEY = ['tenant_domains']

export type DomainOperationResult = {
  domain?: import('@/lib/services/tenantSite').TenantDomain
  dns_records?: VitrinaDnsRecord[]
  message?: string
}

export function useProvisionSubdomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => vitrinaDomainApi.provisionSubdomain(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOMAINS_KEY })
    },
  })
}

export function useAddCustomDomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (domain: string) => vitrinaDomainApi.addCustomDomain(domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOMAINS_KEY })
    },
  })
}

export function useVerifyDomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (domainId: string) => vitrinaDomainApi.verifyDomain(domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOMAINS_KEY })
    },
  })
}

export function useSetPrimaryDomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (domainId: string) => vitrinaDomainApi.setPrimary(domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOMAINS_KEY })
    },
  })
}

export function useRemoveDomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (domainId: string) => vitrinaDomainApi.removeDomain(domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOMAINS_KEY })
    },
  })
}
