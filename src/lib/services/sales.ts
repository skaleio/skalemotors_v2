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
        branch:branches(id, name),
        sale_expenses(id, amount, description)
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
        branch:branches(*),
        sale_expenses(id, amount, description, created_at)
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

  // Eliminar una venta y revertir datos relacionados (lead y vehículo)
  async delete(id: string) {
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('id, lead_id, vehicle_id')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    if (!sale) throw new Error('Venta no encontrada')

    const { error: deleteError } = await supabase.from('sales').delete().eq('id', id)
    if (deleteError) throw deleteError

    // Revertir estado del lead (ya no vendido por esta venta)
    if (sale.lead_id) {
      await supabase.from('leads').update({ status: 'negociando' }).eq('id', sale.lead_id)
    }

    // Revertir estado del vehículo a disponible
    if (sale.vehicle_id) {
      await supabase.from('vehicles').update({ status: 'disponible' }).eq('id', sale.vehicle_id)
    }
  },

  // Crear gastos asociados a una venta
  async createExpenses(saleId: string, items: { amount: number; description?: string | null }[]) {
    if (items.length === 0) return
    const rows = items.map((item) => ({
      sale_id: saleId,
      amount: item.amount,
      description: item.description?.trim() || null,
    }))
    const { error } = await supabase.from('sale_expenses').insert(rows)
    if (error) throw error
  },

  // Eliminar todos los gastos de una venta (para reemplazar al editar)
  async deleteExpensesBySaleId(saleId: string) {
    const { error } = await supabase.from('sale_expenses').delete().eq('sale_id', saleId)
    if (error) throw error
  },

  // Obtener estadísticas de ventas (incluye gastos y ganancia neta)
  async getStats(userId?: string, branchId?: string, days: number = 30) {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)

    let query = supabase
      .from('sales')
      .select('id, sale_price, margin, commission, sale_date, status')

    if (userId) {
      query = query.eq('seller_id', userId)
    }

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    query = query.gte('sale_date', dateFrom.toISOString().split('T')[0])

    const { data, error } = await query

    if (error) throw error

    const saleIds = (data ?? []).map((s) => s.id)
    let totalExpenses = 0
    if (saleIds.length > 0) {
      const { data: expensesData } = await supabase
        .from('sale_expenses')
        .select('amount')
        .in('sale_id', saleIds)
      totalExpenses = (expensesData ?? []).reduce((sum, e) => sum + Number(e.amount || 0), 0)
    }

    const totalMargin = (data ?? []).reduce((sum, s) => sum + Number(s.margin || 0), 0)
    const netMargin = totalMargin - totalExpenses

    const stats = {
      total: (data ?? []).length,
      totalRevenue: (data ?? []).reduce((sum, s) => sum + Number(s.sale_price || 0), 0),
      totalMargin,
      totalExpenses,
      netMargin,
      totalCommission: (data ?? []).reduce((sum, s) => sum + Number(s.commission || 0), 0),
      averageSalePrice: (data ?? []).length > 0
        ? (data ?? []).reduce((sum, s) => sum + Number(s.sale_price || 0), 0) / (data ?? []).length
        : 0,
      completed: (data ?? []).filter((s) => s.status === 'completada').length,
      pending: (data ?? []).filter((s) => s.status === 'pendiente').length,
    }

    return stats
  },
}


