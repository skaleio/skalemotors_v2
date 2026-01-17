import { supabase } from '../supabase'
import type { Database } from '../types/database'

type Sale = Database['public']['Tables']['sales']['Row']
type SaleInsert = Database['public']['Tables']['sales']['Insert']
type SaleUpdate = Database['public']['Tables']['sales']['Update']

export const saleService = {
  // Obtener todas las ventas
  async getAll(filters?: {
    sellerId?: string
    branchId?: string
    status?: string
    dateFrom?: string
    dateTo?: string
  }) {
    let query = supabase
      .from('sales')
      .select(`
        *,
        lead:leads(id, full_name, email, phone),
        vehicle:vehicles(id, make, model, year, vin),
        seller:users!sales_seller_id_fkey(id, full_name, email),
        branch:branches(id, name)
      `)
      .order('created_at', { ascending: false })

    if (filters?.sellerId) {
      query = query.eq('seller_id', filters.sellerId)
    }

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.dateFrom) {
      query = query.gte('sale_date', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('sale_date', filters.dateTo)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Sale[]
  },

  // Obtener una venta por ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        lead:leads(*),
        vehicle:vehicles(*),
        seller:users!sales_seller_id_fkey(*),
        branch:branches(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Sale
  },

  // Crear una nueva venta
  async create(sale: SaleInsert) {
    const { data, error } = await supabase
      .from('sales')
      .insert(sale)
      .select(`
        *,
        lead:leads(id, full_name),
        vehicle:vehicles(id, make, model),
        seller:users!sales_seller_id_fkey(id, full_name)
      `)
      .single()

    if (error) throw error

    // Actualizar estado del lead a 'vendido'
    if (sale.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'vendido' })
        .eq('id', sale.lead_id)
    }

    // Actualizar estado del vehículo a 'vendido'
    if (sale.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ status: 'vendido' })
        .eq('id', sale.vehicle_id)
    }

    return data as Sale
  },

  // Actualizar una venta
  async update(id: string, updates: SaleUpdate) {
    const { data, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Sale
  },

  // Obtener estadísticas de ventas
  async getStats(userId?: string, branchId?: string, days: number = 30) {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    let query = supabase
      .from('sales')
      .select('sale_price, margin, commission, sale_date, status')

    if (userId) {
      query = query.eq('seller_id', userId)
    }

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    query = query.gte('sale_date', dateFrom.toISOString().split('T')[0])

    const { data, error } = await query

    if (error) throw error

    const stats = {
      total: data.length,
      totalRevenue: data.reduce((sum, s) => sum + Number(s.sale_price || 0), 0),
      totalMargin: data.reduce((sum, s) => sum + Number(s.margin || 0), 0),
      totalCommission: data.reduce((sum, s) => sum + Number(s.commission || 0), 0),
      averageSalePrice: data.length > 0 
        ? data.reduce((sum, s) => sum + Number(s.sale_price || 0), 0) / data.length 
        : 0,
      completed: data.filter(s => s.status === 'completada').length,
      pending: data.filter(s => s.status === 'pendiente').length
    }

    return stats
  }
}


