// Tipos generados automáticamente de Supabase
// Para generar estos tipos, ejecuta:
// npx supabase gen types typescript --project-id knczbjmiqhkopsytkauo > src/lib/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string
          title: string
          description: string | null
          type: 'test_drive' | 'meeting' | 'delivery' | 'service' | 'other'
          status: 'programada' | 'completada' | 'cancelada'
          scheduled_at: string
          end_at: string
          lead_id: string | null
          vehicle_id: string | null
          user_id: string | null
          branch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type?: 'test_drive' | 'meeting' | 'delivery' | 'service' | 'other'
          status?: 'programada' | 'completada' | 'cancelada'
          scheduled_at: string
          end_at: string
          lead_id?: string | null
          vehicle_id?: string | null
          user_id?: string | null
          branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          type?: 'test_drive' | 'meeting' | 'delivery' | 'service' | 'other'
          status?: 'programada' | 'completada' | 'cancelada'
          scheduled_at?: string
          end_at?: string
          lead_id?: string | null
          vehicle_id?: string | null
          user_id?: string | null
          branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      branches: {
        Row: {
          id: string
          name: string
          address: string
          phone: string | null
          email: string | null
          manager_id: string | null
          city: string
          region: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          phone?: string | null
          email?: string | null
          manager_id?: string | null
          city: string
          region: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          phone?: string | null
          email?: string | null
          manager_id?: string | null
          city?: string
          region?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          role: 'admin' | 'gerente' | 'vendedor' | 'financiero' | 'servicio' | 'inventario'
          branch_id: string | null
          is_active: boolean
          avatar_url: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          phone?: string | null
          role?: 'admin' | 'gerente' | 'vendedor' | 'financiero' | 'servicio' | 'inventario'
          branch_id?: string | null
          is_active?: boolean
          avatar_url?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          phone?: string | null
          role?: 'admin' | 'gerente' | 'vendedor' | 'financiero' | 'servicio' | 'inventario'
          branch_id?: string | null
          is_active?: boolean
          avatar_url?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          vin: string
          make: string
          model: string
          year: number
          color: string
          mileage: number | null
          fuel_type: 'gasolina' | 'diesel' | 'híbrido' | 'eléctrico' | null
          transmission: 'manual' | 'automático' | 'cvt' | null
          engine_size: string | null
          doors: number | null
          seats: number | null
          category: 'nuevo' | 'usado' | 'consignado'
          condition: 'excelente' | 'bueno' | 'regular' | 'malo' | null
          price: number
          cost: number | null
          margin: number | null
          status: 'disponible' | 'reservado' | 'vendido' | 'en_reparacion' | 'fuera_de_servicio'
          branch_id: string | null
          location: string | null
          description: string | null
          features: Json
          images: Json
          documents: Json
          arrival_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vin: string
          make: string
          model: string
          year: number
          color: string
          mileage?: number | null
          fuel_type?: 'gasolina' | 'diesel' | 'híbrido' | 'eléctrico' | null
          transmission?: 'manual' | 'automático' | 'cvt' | null
          engine_size?: string | null
          doors?: number | null
          seats?: number | null
          category: 'nuevo' | 'usado' | 'consignado'
          condition?: 'excelente' | 'bueno' | 'regular' | 'malo' | null
          price: number
          cost?: number | null
          margin?: number | null
          status?: 'disponible' | 'reservado' | 'vendido' | 'en_reparacion' | 'fuera_de_servicio'
          branch_id?: string | null
          location?: string | null
          description?: string | null
          features?: Json
          images?: Json
          documents?: Json
          arrival_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vin?: string
          make?: string
          model?: string
          year?: number
          color?: string
          mileage?: number | null
          fuel_type?: 'gasolina' | 'diesel' | 'híbrido' | 'eléctrico' | null
          transmission?: 'manual' | 'automático' | 'cvt' | null
          engine_size?: string | null
          doors?: number | null
          seats?: number | null
          category?: 'nuevo' | 'usado' | 'consignado'
          condition?: 'excelente' | 'bueno' | 'regular' | 'malo' | null
          price?: number
          cost?: number | null
          margin?: number | null
          status?: 'disponible' | 'reservado' | 'vendido' | 'en_reparacion' | 'fuera_de_servicio'
          branch_id?: string | null
          location?: string | null
          description?: string | null
          features?: Json
          images?: Json
          documents?: Json
          arrival_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      consignaciones: {
        Row: {
          id: string
          branch_id: string | null
          lead_id: string | null
          vehicle_id: string | null
          owner_name: string
          owner_phone: string | null
          owner_email: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year: number | null
          vehicle_vin: string | null
          vehicle_km: number | null
          label: string | null
          status: 'nuevo' | 'en_revision' | 'en_venta' | 'negociando' | 'vendido' | 'devuelto'
          notes: string | null
          created_by: string | null
          meeting_at: string | null
          consignacion_price: number | null
          sale_price: number | null
          fecha: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id?: string | null
          lead_id?: string | null
          vehicle_id?: string | null
          owner_name: string
          owner_phone?: string | null
          owner_email?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
          vehicle_vin?: string | null
          vehicle_km?: number | null
          label?: string | null
          status?: 'nuevo' | 'en_revision' | 'en_venta' | 'negociando' | 'vendido' | 'devuelto'
          notes?: string | null
          created_by?: string | null
          meeting_at?: string | null
          consignacion_price?: number | null
          sale_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string | null
          lead_id?: string | null
          vehicle_id?: string | null
          owner_name?: string
          owner_phone?: string | null
          owner_email?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year?: number | null
          vehicle_vin?: string | null
          vehicle_km?: number | null
          label?: string | null
          status?: 'nuevo' | 'en_revision' | 'en_venta' | 'negociando' | 'vendido' | 'devuelto'
          notes?: string | null
          created_by?: string | null
          meeting_at?: string | null
          consignacion_price?: number | null
          sale_price?: number | null
          fecha?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string
          source: 'web' | 'referido' | 'walk_in' | 'telefono' | 'redes_sociales' | 'evento' | 'otro'
          status: 'nuevo' | 'contactado' | 'interesado' | 'cotizando' | 'negociando' | 'vendido' | 'perdido'
          priority: 'baja' | 'media' | 'alta'
          assigned_to: string | null
          branch_id: string | null
          region: string | null
          payment_type: string | null
          budget: string | null
          budget_min: number | null
          budget_max: number | null
          preferred_vehicle_id: string | null
          notes: string | null
          tags: Json
          last_contact_at: string | null
          next_follow_up: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone: string
          source: 'web' | 'referido' | 'walk_in' | 'telefono' | 'redes_sociales' | 'evento' | 'otro'
          status?: 'nuevo' | 'contactado' | 'interesado' | 'cotizando' | 'negociando' | 'vendido' | 'perdido'
          priority?: 'baja' | 'media' | 'alta'
          assigned_to?: string | null
          branch_id?: string | null
          region?: string | null
          payment_type?: string | null
          budget?: string | null
          budget_min?: number | null
          budget_max?: number | null
          preferred_vehicle_id?: string | null
          notes?: string | null
          tags?: Json
          last_contact_at?: string | null
          next_follow_up?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string
          source?: 'web' | 'referido' | 'walk_in' | 'telefono' | 'redes_sociales' | 'evento' | 'otro'
          status?: 'nuevo' | 'contactado' | 'interesado' | 'cotizando' | 'negociando' | 'vendido' | 'perdido'
          priority?: 'baja' | 'media' | 'alta'
          assigned_to?: string | null
          branch_id?: string | null
          region?: string | null
          payment_type?: string | null
          budget?: string | null
          budget_min?: number | null
          budget_max?: number | null
          preferred_vehicle_id?: string | null
          notes?: string | null
          tags?: Json
          last_contact_at?: string | null
          next_follow_up?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          user_id: string | null
          type: 'llamada' | 'email' | 'whatsapp' | 'reunion' | 'test_drive' | 'cotizacion' | 'nota'
          subject: string | null
          description: string | null
          outcome: string | null
          duration_minutes: number | null
          scheduled_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          user_id?: string | null
          type: 'llamada' | 'email' | 'whatsapp' | 'reunion' | 'test_drive' | 'cotizacion' | 'nota'
          subject?: string | null
          description?: string | null
          outcome?: string | null
          duration_minutes?: number | null
          scheduled_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          user_id?: string | null
          type?: 'llamada' | 'email' | 'whatsapp' | 'reunion' | 'test_drive' | 'cotizacion' | 'nota'
          subject?: string | null
          description?: string | null
          outcome?: string | null
          duration_minutes?: number | null
          scheduled_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      pending_tasks: {
        Row: {
          id: string
          branch_id: string
          assigned_to: string | null
          priority: 'urgent' | 'today' | 'later'
          title: string
          description: string | null
          action_type: 'contactar' | 'llamar' | 'confirmar' | 'enviar_cotizacion' | 'otro'
          action_label: string
          entity_type: 'lead' | 'appointment' | 'custom'
          entity_id: string | null
          metadata: Json
          source: 'rule' | 'llm' | 'whatsapp'
          due_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          assigned_to?: string | null
          priority?: 'urgent' | 'today' | 'later'
          title: string
          description?: string | null
          action_type?: 'contactar' | 'llamar' | 'confirmar' | 'enviar_cotizacion' | 'otro'
          action_label?: string
          entity_type?: 'lead' | 'appointment' | 'custom'
          entity_id?: string | null
          metadata?: Json
          source?: 'rule' | 'llm' | 'whatsapp'
          due_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          assigned_to?: string | null
          priority?: 'urgent' | 'today' | 'later'
          title?: string
          description?: string | null
          action_type?: 'contactar' | 'llamar' | 'confirmar' | 'enviar_cotizacion' | 'otro'
          action_label?: string
          entity_type?: 'lead' | 'appointment' | 'custom'
          entity_id?: string | null
          metadata?: Json
          source?: 'rule' | 'llm' | 'whatsapp'
          due_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      marketplace_connections: {
        Row: {
          id: string
          branch_id: string
          platform: 'mercadolibre' | 'facebook' | 'chileautos'
          credentials: Json
          status: 'active' | 'inactive' | 'error'
          last_error: string | null
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          platform: 'mercadolibre' | 'facebook' | 'chileautos'
          credentials?: Json
          status?: 'active' | 'inactive' | 'error'
          last_error?: string | null
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          platform?: 'mercadolibre' | 'facebook' | 'chileautos'
          credentials?: Json
          status?: 'active' | 'inactive' | 'error'
          last_error?: string | null
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vehicle_listings: {
        Row: {
          id: string
          vehicle_id: string
          platform: 'mercadolibre' | 'facebook' | 'chileautos'
          external_id: string | null
          external_url: string | null
          status: 'draft' | 'published' | 'paused' | 'error' | 'syncing'
          last_synced_at: string | null
          last_error: string | null
          payload_sent: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          platform: 'mercadolibre' | 'facebook' | 'chileautos'
          external_id?: string | null
          external_url?: string | null
          status?: 'draft' | 'published' | 'paused' | 'error' | 'syncing'
          last_synced_at?: string | null
          last_error?: string | null
          payload_sent?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          platform?: 'mercadolibre' | 'facebook' | 'chileautos'
          external_id?: string | null
          external_url?: string | null
          status?: 'draft' | 'published' | 'paused' | 'error' | 'syncing'
          last_synced_at?: string | null
          last_error?: string | null
          payload_sent?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          lead_id: string | null
          user_id: string | null
          type: 'whatsapp' | 'email' | 'sms' | 'chat'
          direction: 'entrante' | 'saliente'
          subject: string | null
          content: string
          status: 'enviado' | 'entregado' | 'leido' | 'fallido'
          sent_at: string
          read_at: string | null
          created_at: string
          branch_id: string | null
          inbox_id: string | null
          contact_phone: string | null
          contact_name: string | null
          provider: string | null
          provider_message_id: string | null
          provider_status_id: string | null
          raw_payload: Json | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          type: 'whatsapp' | 'email' | 'sms' | 'chat'
          direction: 'entrante' | 'saliente'
          subject?: string | null
          content: string
          status?: 'enviado' | 'entregado' | 'leido' | 'fallido'
          sent_at?: string
          read_at?: string | null
          created_at?: string
          branch_id?: string | null
          inbox_id?: string | null
          contact_phone?: string | null
          contact_name?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_status_id?: string | null
          raw_payload?: Json | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          type?: 'whatsapp' | 'email' | 'sms' | 'chat'
          direction?: 'entrante' | 'saliente'
          subject?: string | null
          content?: string
          status?: 'enviado' | 'entregado' | 'leido' | 'fallido'
          sent_at?: string
          read_at?: string | null
          created_at?: string
          branch_id?: string | null
          inbox_id?: string | null
          contact_phone?: string | null
          contact_name?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_status_id?: string | null
          raw_payload?: Json | null
        }
      }
      whatsapp_inboxes: {
        Row: {
          id: string
          provider: string
          provider_phone_number_id: string
          display_number: string | null
          branch_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider?: string
          provider_phone_number_id: string
          display_number?: string | null
          branch_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider?: string
          provider_phone_number_id?: string
          display_number?: string | null
          branch_id?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      executive_dashboard: {
        Row: {
          month: string | null
          total_sales: number | null
          total_revenue: number | null
          average_sale_price: number | null
          total_margin: number | null
          active_sellers: number | null
          total_leads: number | null
          converted_leads: number | null
        }
      }
    }
    Functions: {
      get_lead_stats: {
        Args: {
          user_id?: string
        }
        Returns: {
          total_leads: number
          new_leads: number
          contacted_leads: number
          interested_leads: number
          quoted_leads: number
          sold_leads: number
        }[]
      }
      get_sales_metrics: {
        Args: {
          user_id?: string
          days?: number
        }
        Returns: {
          total_sales: number
          total_revenue: number
          average_sale_price: number
          total_margin: number
          total_commission: number
        }[]
      }
    }
  }
}


