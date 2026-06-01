import { supabase } from '../supabase'
import type { TenantDomain } from './tenantSite'

export type VitrinaDnsRecord = {
  type: string
  name: string
  value: string
  reason?: string
}

export type VitrinaDomainAction =
  | 'provision_subdomain'
  | 'add'
  | 'verify'
  | 'remove'
  | 'set_primary'
  | 'status'

type VitrinaDomainResponse = {
  ok: boolean
  error?: string
  domain?: TenantDomain
  dns_records?: VitrinaDnsRecord[]
  vercel_configured?: boolean
  message?: string
  removed_domain?: string
}

async function invokeVitrinaDomain(body: Record<string, unknown>): Promise<VitrinaDomainResponse> {
  const { data, error } = await supabase.functions.invoke<VitrinaDomainResponse>('vitrina-domain', {
    body,
  })
  if (error) throw error
  if (!data?.ok) {
    throw new Error(data?.error ?? 'Error al gestionar el dominio')
  }
  return data
}

export const vitrinaDomainApi = {
  provisionSubdomain(): Promise<VitrinaDomainResponse> {
    return invokeVitrinaDomain({ action: 'provision_subdomain' })
  },

  addCustomDomain(domain: string): Promise<VitrinaDomainResponse> {
    return invokeVitrinaDomain({ action: 'add', domain: domain.trim() })
  },

  verifyDomain(domainId: string): Promise<VitrinaDomainResponse> {
    return invokeVitrinaDomain({ action: 'verify', domain_id: domainId })
  },

  getDomainStatus(domainId: string): Promise<VitrinaDomainResponse> {
    return invokeVitrinaDomain({ action: 'status', domain_id: domainId })
  },

  setPrimary(domainId: string): Promise<VitrinaDomainResponse> {
    return invokeVitrinaDomain({ action: 'set_primary', domain_id: domainId })
  },

  removeDomain(domainId: string): Promise<VitrinaDomainResponse> {
    return invokeVitrinaDomain({ action: 'remove', domain_id: domainId })
  },
}
