import { supabase } from '../supabase'
import type { Database } from '../types/database'

type Quote = Database['public']['Tables']['quotes']['Row']
type QuoteInsert = Database['public']['Tables']['quotes']['Insert']
type QuoteUpdate = Database['public']['Tables']['quotes']['Update']

export const quoteService = {
  // Obtener todas las cotizaciones
  async getAll(filters?: {
    leadId?: string
    vehicleId?: string
    sellerId?: string
    status?: string
  }) {
    let query = supabase
      .from('quotes')
      .select(`
        *,
        lead:leads(id, full_name, email, phone),
        vehicle:vehicles(id, make, model, year, price, images),
        seller:users!quotes_seller_id_fkey(id, full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (filters?.leadId) {
      query = query.eq('lead_id', filters.leadId)
    }

    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId)
    }

    if (filters?.sellerId) {
      query = query.eq('seller_id', filters.sellerId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Quote[]
  },

  // Obtener una cotización por ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        lead:leads(*),
        vehicle:vehicles(*),
        seller:users!quotes_seller_id_fkey(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Quote
  },

  // Crear una nueva cotización
  async create(quote: QuoteInsert) {
    const { data, error } = await supabase
      .from('quotes')
      .insert(quote)
      .select(`
        *,
        lead:leads(id, full_name, email),
        vehicle:vehicles(id, make, model, price),
        seller:users!quotes_seller_id_fkey(id, full_name)
      `)
      .single()

    if (error) throw error

    // Actualizar estado del lead a 'cotizando'
    if (quote.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'cotizando' })
        .eq('id', quote.lead_id)
    }

    return data as Quote
  },

  // Actualizar una cotización
  async update(id: string, updates: QuoteUpdate) {
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Quote
  },

  // Eliminar una cotización
  async delete(id: string) {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Aceptar una cotización
  async accept(id: string) {
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'aceptada' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Actualizar estado del lead
    if (data.lead_id) {
      await supabase
        .from('leads')
        .update({ status: 'negociando' })
        .eq('id', data.lead_id)
    }

    return data as Quote
  }
}


