export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_branch_brain: {
        Row: {
          branch_id: string | null
          id: string
          snapshot_text: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          id?: string
          snapshot_text: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          id?: string
          snapshot_text?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_branch_brain_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_branch_brain_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          tenant_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tenant_id: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tenant_id: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_pricing: {
        Row: {
          input_per_1k_usd: number
          model: string
          notes: string | null
          output_per_1k_usd: number
          provider: string
          updated_at: string
        }
        Insert: {
          input_per_1k_usd: number
          model: string
          notes?: string | null
          output_per_1k_usd: number
          provider: string
          updated_at?: string
        }
        Update: {
          input_per_1k_usd?: number
          model?: string
          notes?: string | null
          output_per_1k_usd?: number
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          branch_id: string | null
          created_at: string
          feature: string
          id: string
          model: string | null
          tenant_id: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          feature: string
          id?: string
          model?: string | null
          tenant_id: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          feature?: string
          id?: string
          model?: string | null
          tenant_id?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          branch_id: string | null
          client_phone: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          end_at: string | null
          id: string
          lead_id: string | null
          location: string | null
          notes: string | null
          reminder_sent: boolean | null
          scheduled_at: string
          status: string
          tenant_id: string
          title: string | null
          type: string
          updated_at: string | null
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          branch_id?: string | null
          client_phone?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          reminder_sent?: boolean | null
          scheduled_at: string
          status?: string
          tenant_id: string
          title?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          branch_id?: string | null
          client_phone?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          end_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          reminder_sent?: boolean | null
          scheduled_at?: string
          status?: string
          tenant_id?: string
          title?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      autofact_config: {
        Row: {
          api_key_encrypted: string | null
          branch_id: string
          created_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          branch_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          branch_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autofact_config_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autofact_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_sales_staff: {
        Row: {
          base_salary_clp: number
          branch_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          monthly_sales_goal: number | null
          role_label: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_salary_clp?: number
          branch_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          monthly_sales_goal?: number | null
          role_label?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_salary_clp?: number
          branch_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          monthly_sales_goal?: number | null
          role_label?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_sales_staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_sales_staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          opening_hours: string | null
          phone: string | null
          region: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          opening_hours?: string | null
          phone?: string | null
          region?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          opening_hours?: string | null
          phone?: string | null
          region?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chileautos_saved_listings: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          listing_id: string | null
          listing_url: string | null
          make: string | null
          model: string | null
          notes: string | null
          price_text: string | null
          source: string
          state: string | null
          tenant_id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          listing_url?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          price_text?: string | null
          source?: string
          state?: string | null
          tenant_id: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          listing_url?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          price_text?: string | null
          source?: string
          state?: string | null
          tenant_id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chileautos_saved_listings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chileautos_saved_listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consignaciones: {
        Row: {
          branch_id: string | null
          carroceria: string | null
          color: string | null
          combustible: string | null
          consignacion_price: number | null
          created_at: string | null
          created_by: string | null
          engine_number: string | null
          fecha: string | null
          id: string
          label: string
          lead_id: string | null
          meeting_at: string | null
          motor: string | null
          notes: string | null
          owner_email: string | null
          owner_name: string
          owner_phone: string | null
          patente: string | null
          publicado: boolean
          sale_price: number | null
          status: string
          tenant_id: string
          transmision: string | null
          updated_at: string | null
          vehicle_id: string | null
          vehicle_km: number | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_vin: string | null
          vehicle_year: number | null
        }
        Insert: {
          branch_id?: string | null
          carroceria?: string | null
          color?: string | null
          combustible?: string | null
          consignacion_price?: number | null
          created_at?: string | null
          created_by?: string | null
          engine_number?: string | null
          fecha?: string | null
          id?: string
          label?: string
          lead_id?: string | null
          meeting_at?: string | null
          motor?: string | null
          notes?: string | null
          owner_email?: string | null
          owner_name: string
          owner_phone?: string | null
          patente?: string | null
          publicado?: boolean
          sale_price?: number | null
          status?: string
          tenant_id: string
          transmision?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_km?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_vin?: string | null
          vehicle_year?: number | null
        }
        Update: {
          branch_id?: string | null
          carroceria?: string | null
          color?: string | null
          combustible?: string | null
          consignacion_price?: number | null
          created_at?: string | null
          created_by?: string | null
          engine_number?: string | null
          fecha?: string | null
          id?: string
          label?: string
          lead_id?: string | null
          meeting_at?: string | null
          motor?: string | null
          notes?: string | null
          owner_email?: string | null
          owner_name?: string
          owner_phone?: string | null
          patente?: string | null
          publicado?: boolean
          sale_price?: number | null
          status?: string
          tenant_id?: string
          transmision?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_km?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_vin?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consignaciones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignaciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignaciones_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignaciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consignaciones_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_reports: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          payload: Json
          report_date: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          report_date: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          report_date?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          request_type: string
          requested_by: string | null
          status: string
          subject_id: string
          subject_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_type: string
          requested_by?: string | null
          status?: string
          subject_id: string
          subject_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_type?: string
          requested_by?: string | null
          status?: string
          subject_id?: string
          subject_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          branch_id: string | null
          clauses: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          settings: Json
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          clauses?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          settings?: Json
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          clauses?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          settings?: Json
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          branch_id: string | null
          buyer_address: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_rut: string | null
          commission_amount: number | null
          commission_percentage: number | null
          consignacion_id: string | null
          created_at: string | null
          created_by: string | null
          document_number: string | null
          id: string
          layout_settings: Json | null
          lead_id: string | null
          min_sale_price: number | null
          notes: string | null
          owner_address: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_rut: string | null
          payment_method: string | null
          sale_id: string | null
          sale_price: number | null
          status: string | null
          template_id: string | null
          tenant_id: string
          type: string
          updated_at: string | null
          vehicle_chasis: string | null
          vehicle_color: string | null
          vehicle_id: string | null
          vehicle_km: number | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_motor: string | null
          vehicle_patente: string | null
          vehicle_vin: string | null
          vehicle_year: number | null
        }
        Insert: {
          branch_id?: string | null
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_rut?: string | null
          commission_amount?: number | null
          commission_percentage?: number | null
          consignacion_id?: string | null
          created_at?: string | null
          created_by?: string | null
          document_number?: string | null
          id?: string
          layout_settings?: Json | null
          lead_id?: string | null
          min_sale_price?: number | null
          notes?: string | null
          owner_address?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_rut?: string | null
          payment_method?: string | null
          sale_id?: string | null
          sale_price?: number | null
          status?: string | null
          template_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
          vehicle_chasis?: string | null
          vehicle_color?: string | null
          vehicle_id?: string | null
          vehicle_km?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_motor?: string | null
          vehicle_patente?: string | null
          vehicle_vin?: string | null
          vehicle_year?: number | null
        }
        Update: {
          branch_id?: string | null
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_rut?: string | null
          commission_amount?: number | null
          commission_percentage?: number | null
          consignacion_id?: string | null
          created_at?: string | null
          created_by?: string | null
          document_number?: string | null
          id?: string
          layout_settings?: Json | null
          lead_id?: string | null
          min_sale_price?: number | null
          notes?: string | null
          owner_address?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_rut?: string | null
          payment_method?: string | null
          sale_id?: string | null
          sale_price?: number | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
          vehicle_chasis?: string | null
          vehicle_color?: string | null
          vehicle_id?: string | null
          vehicle_km?: number | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_motor?: string | null
          vehicle_patente?: string | null
          vehicle_vin?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_consignacion_id_fkey"
            columns: ["consignacion_id"]
            isOneToOne: false
            referencedRelation: "consignaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_rate_limits: {
        Row: {
          count: number
          identifier: string
          route: string
          window_start: string
        }
        Insert: {
          count?: number
          identifier: string
          route: string
          window_start: string
        }
        Update: {
          count?: number
          identifier?: string
          route?: string
          window_start?: string
        }
        Relationships: []
      }
      expense_types: {
        Row: {
          code: string
          created_at: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: number
          note: string
          organization_id: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          month: number
          note?: string
          organization_id?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: number
          note?: string
          organization_id?: string
          year?: number
        }
        Relationships: []
      }
      finance_expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      finance_expenses: {
        Row: {
          amount: number
          category_id: string | null
          category_name: string
          created_at: string
          description: string
          expense_date: string
          from_reserve_fund: boolean
          id: string
          notes: string | null
          organization_id: string
          paid_by: string
          payer_name: string | null
          reimbursable: boolean
          reimbursed: boolean
          team_branch: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          category_name: string
          created_at?: string
          description: string
          expense_date: string
          from_reserve_fund?: boolean
          id?: string
          notes?: string | null
          organization_id?: string
          paid_by: string
          payer_name?: string | null
          reimbursable?: boolean
          reimbursed?: boolean
          team_branch?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          category_name?: string
          created_at?: string
          description?: string
          expense_date?: string
          from_reserve_fund?: boolean
          id?: string
          notes?: string | null
          organization_id?: string
          paid_by?: string
          payer_name?: string | null
          reimbursable?: boolean
          reimbursed?: boolean
          team_branch?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_formula_miami_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          organization_id: string
          paid_at: string
          program_month: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          paid_at?: string
          program_month: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          paid_at?: string
          program_month?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_income: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          income_date: string
          label: string
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          income_date: string
          label: string
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          income_date?: string
          label?: string
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_monthly_close: {
        Row: {
          closed_at: string
          id: string
          month: number
          organization_id: string
          snapshot: Json
          year: number
        }
        Insert: {
          closed_at?: string
          id?: string
          month: number
          organization_id?: string
          snapshot: Json
          year: number
        }
        Update: {
          closed_at?: string
          id?: string
          month?: number
          organization_id?: string
          snapshot?: Json
          year?: number
        }
        Relationships: []
      }
      finance_profit_distribution: {
        Row: {
          allocations: Json
          id: string
          month: number
          organization_id: string
          profit_amount: number
          saved_at: string
          year: number
        }
        Insert: {
          allocations?: Json
          id?: string
          month: number
          organization_id?: string
          profit_amount: number
          saved_at?: string
          year: number
        }
        Update: {
          allocations?: Json
          id?: string
          month?: number
          organization_id?: string
          profit_amount?: number
          saved_at?: string
          year?: number
        }
        Relationships: []
      }
      finance_settings: {
        Row: {
          organization_id: string
          partners: Json
          percent_schedules: Json
          updated_at: string
        }
        Insert: {
          organization_id?: string
          partners?: Json
          percent_schedules?: Json
          updated_at?: string
        }
        Update: {
          organization_id?: string
          partners?: Json
          percent_schedules?: Json
          updated_at?: string
        }
        Relationships: []
      }
      formula_appointments: {
        Row: {
          cancelled_at: string | null
          created_at: string
          ends_at: string
          id: string
          lead_id: string
          resource_id: string
          source: string
          starts_at: string
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          lead_id: string
          resource_id: string
          source?: string
          starts_at: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          lead_id?: string
          resource_id?: string
          source?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "formula_crm_appointments_v"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "formula_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "formula_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "formula_calendar_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_availability_rules: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          resource_id: string
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          resource_id: string
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          resource_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_availability_rules_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "formula_calendar_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_calendar_resources: {
        Row: {
          created_at: string
          id: string
          name: string
          slot_duration_minutes: number
          slug: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slot_duration_minutes?: number
          slug: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slot_duration_minutes?: number
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      formula_leads: {
        Row: {
          automotora: string | null
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          ingresos_mensuales: string | null
          mensaje: string | null
          nombre: string
          origen: string
          stage: string
          telefono: string
          updated_at: string
        }
        Insert: {
          automotora?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          ingresos_mensuales?: string | null
          mensaje?: string | null
          nombre: string
          origen?: string
          stage?: string
          telefono: string
          updated_at?: string
        }
        Update: {
          automotora?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          ingresos_mensuales?: string | null
          mensaje?: string | null
          nombre?: string
          origen?: string
          stage?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: []
      }
      formula_student_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          paid_at: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_student_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "formula_students"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_students: {
        Row: {
          automotora: string
          ciclo_facturacion: Database["public"]["Enums"]["formula_billing_cycle"]
          cohorte: string
          created_at: string
          deleted_at: string | null
          email: string
          estado_pago: Database["public"]["Enums"]["formula_payment_status"]
          id: string
          inscrito_en: string
          lead_id: string | null
          mentor: string
          monto_plan: number
          nombre: string
          notas: string | null
          programa: string
          progreso_pct: number
          proxima_renovacion_en: string | null
          status: Database["public"]["Enums"]["formula_student_status"]
          telefono: string
          ultima_sesion: string | null
          ultimo_pago_en: string | null
          updated_at: string
        }
        Insert: {
          automotora?: string
          ciclo_facturacion?: Database["public"]["Enums"]["formula_billing_cycle"]
          cohorte?: string
          created_at?: string
          deleted_at?: string | null
          email: string
          estado_pago?: Database["public"]["Enums"]["formula_payment_status"]
          id?: string
          inscrito_en?: string
          lead_id?: string | null
          mentor?: string
          monto_plan?: number
          nombre: string
          notas?: string | null
          programa: string
          progreso_pct?: number
          proxima_renovacion_en?: string | null
          status?: Database["public"]["Enums"]["formula_student_status"]
          telefono?: string
          ultima_sesion?: string | null
          ultimo_pago_en?: string | null
          updated_at?: string
        }
        Update: {
          automotora?: string
          ciclo_facturacion?: Database["public"]["Enums"]["formula_billing_cycle"]
          cohorte?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          estado_pago?: Database["public"]["Enums"]["formula_payment_status"]
          id?: string
          inscrito_en?: string
          lead_id?: string | null
          mentor?: string
          monto_plan?: number
          nombre?: string
          notas?: string | null
          programa?: string
          progreso_pct?: number
          proxima_renovacion_en?: string | null
          status?: Database["public"]["Enums"]["formula_student_status"]
          telefono?: string
          ultima_sesion?: string | null
          ultimo_pago_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "formula_crm_appointments_v"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "formula_students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "formula_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_empresa: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          devolucion: boolean
          expense_date: string
          expense_type: string
          id: string
          inversor_id: string | null
          inversor_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          devolucion?: boolean
          expense_date?: string
          expense_type: string
          id?: string
          inversor_id?: string | null
          inversor_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          devolucion?: boolean
          expense_date?: string
          expense_type?: string
          id?: string
          inversor_id?: string | null
          inversor_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_empresa_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_empresa_inversor_id_fkey"
            columns: ["inversor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_empresa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_empresa: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          description: string | null
          etiqueta: string
          id: string
          income_date: string
          payment_status: string
          sale_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          etiqueta: string
          id?: string
          income_date?: string
          payment_status?: string
          sale_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          etiqueta?: string
          id?: string
          income_date?: string
          payment_status?: string
          sale_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_empresa_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_empresa_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_empresa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          lead_id: string
          outcome: string | null
          scheduled_at: string | null
          subject: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id: string
          outcome?: string | null
          scheduled_at?: string | null
          subject?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string
          outcome?: string | null
          scheduled_at?: string | null
          subject?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_data_consents: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          id: string
          lead_id: string
          recorded_by: string | null
          source: string | null
          tenant_id: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted?: boolean
          id?: string
          lead_id: string
          recorded_by?: string | null
          source?: string | null
          tenant_id: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          lead_id?: string
          recorded_by?: string | null
          source?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_data_consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_data_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ingest_keys: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          secret_hash: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          secret_hash: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          secret_hash?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_ingest_keys_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ingest_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          attachments: Json
          body: string
          branch_id: string | null
          channel: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          next_action_at: string | null
          source: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json
          body: string
          branch_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          next_action_at?: string | null
          source?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json
          body?: string
          branch_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          next_action_at?: string | null
          source?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes_archive: {
        Row: {
          archive_action: string
          archived_at: string
          archived_by: string | null
          attachments: Json
          body: string
          branch_id: string | null
          created_by: string | null
          id: string
          lead_id: string
          note_created_at: string
          note_id: string
          note_updated_at: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          archive_action: string
          archived_at?: string
          archived_by?: string | null
          attachments?: Json
          body: string
          branch_id?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          note_created_at: string
          note_id: string
          note_updated_at?: string | null
          source?: string
          tenant_id: string
        }
        Update: {
          archive_action?: string
          archived_at?: string
          archived_by?: string | null
          attachments?: Json
          body?: string
          branch_id?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          note_created_at?: string
          note_id?: string
          note_updated_at?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_archive_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_archive_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_archive_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_archive_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_archive_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          alerta_crediticia: string | null
          anos_minimo: string | null
          assigned_at: string | null
          assigned_to: string | null
          branch_id: string | null
          budget: string | null
          budget_max: number | null
          budget_min: number | null
          calls_made: number
          closed_at: string | null
          closed_by_staff_id: string | null
          contact_attempts: number
          contact_state: string | null
          created_at: string | null
          created_by: string | null
          crm_seguimiento_socio: string | null
          cuotas_mensuales: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          last_contact_at: string | null
          marca_preferida: string | null
          next_follow_up: string | null
          notes: string | null
          pasajeros_filas: string | null
          payment_type: string | null
          phone: string
          pie_disponible: string | null
          preferencia: string | null
          preferred_vehicle_id: string | null
          priority: string
          raw_message: string | null
          region: string | null
          rut: string | null
          source: string
          state: string | null
          state_confidence: number | null
          state_reason: string | null
          state_updated_at: string | null
          status: string
          status_changed_at: string | null
          tags: Json | null
          tenant_id: string
          transmision: string | null
          updated_at: string | null
          uso_principal: string | null
          vehicle_interest: string | null
          whatsapp_attempts: number
        }
        Insert: {
          alerta_crediticia?: string | null
          anos_minimo?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          budget?: string | null
          budget_max?: number | null
          budget_min?: number | null
          calls_made?: number
          closed_at?: string | null
          closed_by_staff_id?: string | null
          contact_attempts?: number
          contact_state?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_seguimiento_socio?: string | null
          cuotas_mensuales?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_contact_at?: string | null
          marca_preferida?: string | null
          next_follow_up?: string | null
          notes?: string | null
          pasajeros_filas?: string | null
          payment_type?: string | null
          phone: string
          pie_disponible?: string | null
          preferencia?: string | null
          preferred_vehicle_id?: string | null
          priority?: string
          raw_message?: string | null
          region?: string | null
          rut?: string | null
          source?: string
          state?: string | null
          state_confidence?: number | null
          state_reason?: string | null
          state_updated_at?: string | null
          status?: string
          status_changed_at?: string | null
          tags?: Json | null
          tenant_id: string
          transmision?: string | null
          updated_at?: string | null
          uso_principal?: string | null
          vehicle_interest?: string | null
          whatsapp_attempts?: number
        }
        Update: {
          alerta_crediticia?: string | null
          anos_minimo?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          budget?: string | null
          budget_max?: number | null
          budget_min?: number | null
          calls_made?: number
          closed_at?: string | null
          closed_by_staff_id?: string | null
          contact_attempts?: number
          contact_state?: string | null
          created_at?: string | null
          created_by?: string | null
          crm_seguimiento_socio?: string | null
          cuotas_mensuales?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_contact_at?: string | null
          marca_preferida?: string | null
          next_follow_up?: string | null
          notes?: string | null
          pasajeros_filas?: string | null
          payment_type?: string | null
          phone?: string
          pie_disponible?: string | null
          preferencia?: string | null
          preferred_vehicle_id?: string | null
          priority?: string
          raw_message?: string | null
          region?: string | null
          rut?: string | null
          source?: string
          state?: string | null
          state_confidence?: number | null
          state_reason?: string | null
          state_updated_at?: string | null
          status?: string
          status_changed_at?: string | null
          tags?: Json | null
          tenant_id?: string
          transmision?: string | null
          updated_at?: string | null
          uso_principal?: string | null
          vehicle_interest?: string | null
          whatsapp_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_closed_by_staff_id_fkey"
            columns: ["closed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "branch_sales_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_preferred_vehicle_id_fkey"
            columns: ["preferred_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_connections: {
        Row: {
          branch_id: string
          created_at: string | null
          credentials: Json
          id: string
          last_error: string | null
          last_sync_at: string | null
          platform: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          credentials?: Json
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          platform: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          credentials?: Json
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          platform?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_connections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          branch_id: string | null
          contact_name: string | null
          contact_phone: string | null
          content: string
          created_at: string | null
          direction: string
          id: string
          inbox_id: string | null
          lead_id: string | null
          provider: string | null
          provider_message_id: string | null
          provider_status_id: string | null
          raw_payload: Json | null
          read_at: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          tenant_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          content: string
          created_at?: string | null
          direction: string
          id?: string
          inbox_id?: string | null
          lead_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_status_id?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          content?: string
          created_at?: string | null
          direction?: string
          id?: string
          inbox_id?: string | null
          lead_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_status_id?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inboxes_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_connections: {
        Row: {
          access_token: string
          ad_account_id: string | null
          branch_id: string
          created_at: string
          id: string
          last_error: string | null
          status: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          ad_account_id?: string | null
          branch_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          status?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_connections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ads_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_workflow_executions: {
        Row: {
          created_at: string | null
          error_message: string | null
          execution_id: string
          execution_time_ms: number | null
          finished_at: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          started_at: string | null
          status: string
          tenant_id: string
          trigger_type: string | null
          workflow_name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          execution_id: string
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status: string
          tenant_id: string
          trigger_type?: string | null
          workflow_name: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          execution_id?: string
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          trigger_type?: string | null
          workflow_name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_workflow_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_workflow_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "n8n_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_workspaces: {
        Row: {
          ai_agent_config: Json | null
          api_key: string
          automation_rules: Json | null
          branch_id: string
          created_at: string | null
          id: string
          instagram_account: string | null
          is_active: boolean | null
          tenant_id: string
          updated_at: string | null
          webhook_url: string | null
          whatsapp_phone: string | null
          workspace_id: string
        }
        Insert: {
          ai_agent_config?: Json | null
          api_key: string
          automation_rules?: Json | null
          branch_id: string
          created_at?: string | null
          id?: string
          instagram_account?: string | null
          is_active?: boolean | null
          tenant_id: string
          updated_at?: string | null
          webhook_url?: string | null
          whatsapp_phone?: string | null
          workspace_id: string
        }
        Update: {
          ai_agent_config?: Json | null
          api_key?: string
          automation_rules?: Json | null
          branch_id?: string
          created_at?: string | null
          id?: string
          instagram_account?: string | null
          is_active?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          webhook_url?: string | null
          whatsapp_phone?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_workspaces_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          actor_user_id: string | null
          archived_at: string | null
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          metadata: Json
          read_at: string | null
          recipient_user_id: string
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          actor_user_id?: string | null
          archived_at?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_user_id: string
          tenant_id: string
          title: string
          type: string
        }
        Update: {
          action_url?: string | null
          actor_user_id?: string | null
          archived_at?: string | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_user_id?: string
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_tasks: {
        Row: {
          action_label: string
          action_type: string
          assigned_to: string | null
          branch_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          priority: string
          source: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          action_label?: string
          action_type?: string
          assigned_to?: string | null
          branch_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          priority?: string
          source?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          action_label?: string
          action_type?: string
          assigned_to?: string | null
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          priority?: string
          source?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_vendor_provisions: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: string
          tenant_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_vendor_provisions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_vendor_provisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_policy_versions: {
        Row: {
          body_url: string | null
          created_at: string
          effective_at: string
          id: string
          title: string
          version: string
        }
        Insert: {
          body_url?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          title: string
          version: string
        }
        Update: {
          body_url?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      salary_distribution: {
        Row: {
          amounts: Json
          branch_id: string
          created_at: string
          id: string
          month: number
          profit: number
          tenant_id: string
          updated_at: string
          year: number
        }
        Insert: {
          amounts?: Json
          branch_id: string
          created_at?: string
          id?: string
          month: number
          profit?: number
          tenant_id: string
          updated_at?: string
          year: number
        }
        Update: {
          amounts?: Json
          branch_id?: string
          created_at?: string
          id?: string
          month?: number
          profit?: number
          tenant_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_distribution_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_distribution_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_breakdown: {
        Row: {
          comision_consignador: number
          comision_gerencia: number
          comision_venta: number
          consignador_nombre: string | null
          created_at: string
          gasto_general: number
          gasto_total: number
          id: string
          numero_venta: number | null
          pago_final: number
          pct_gerencia: number
          pie: number
          precio_consignacion: number
          precio_total: number
          primer_pago: number
          saldo_precio: number
          sale_id: string
          socios_montos: Json
          socios_params: Json
          tenant_id: string
          updated_at: string
          utilidad_antes_gerencia: number
          utilidad_bruta: number
          utilidad_final_miami: number
          utilidad_post_gerencia: number
        }
        Insert: {
          comision_consignador: number
          comision_gerencia: number
          comision_venta: number
          consignador_nombre?: string | null
          created_at?: string
          gasto_general?: number
          gasto_total: number
          id?: string
          numero_venta?: number | null
          pago_final?: number
          pct_gerencia: number
          pie?: number
          precio_consignacion: number
          precio_total: number
          primer_pago?: number
          saldo_precio: number
          sale_id: string
          socios_montos?: Json
          socios_params?: Json
          tenant_id: string
          updated_at?: string
          utilidad_antes_gerencia: number
          utilidad_bruta: number
          utilidad_final_miami: number
          utilidad_post_gerencia: number
        }
        Update: {
          comision_consignador?: number
          comision_gerencia?: number
          comision_venta?: number
          consignador_nombre?: string | null
          created_at?: string
          gasto_general?: number
          gasto_total?: number
          id?: string
          numero_venta?: number | null
          pago_final?: number
          pct_gerencia?: number
          pie?: number
          precio_consignacion?: number
          precio_total?: number
          primer_pago?: number
          saldo_precio?: number
          sale_id?: string
          socios_montos?: Json
          socios_params?: Json
          tenant_id?: string
          updated_at?: string
          utilidad_antes_gerencia?: number
          utilidad_bruta?: number
          utilidad_final_miami?: number
          utilidad_post_gerencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_breakdown_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_breakdown_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_cascade_settings: {
        Row: {
          comision_consignador_default: number
          comision_venta_default: number
          pct_gerencia: number
          socios: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          comision_consignador_default?: number
          comision_venta_default?: number
          pct_gerencia?: number
          socios?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          comision_consignador_default?: number
          comision_venta_default?: number
          pct_gerencia?: number
          socios?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_cascade_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_expenses: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          sale_id: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          sale_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          sale_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_expenses_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string | null
          client_name: string | null
          commission: number | null
          commission_credit_status: string | null
          created_at: string | null
          delivery_date: string | null
          down_payment: number | null
          financing_amount: number | null
          id: string
          installments: number | null
          lead_id: string | null
          margin: number | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          sale_date: string
          sale_price: number
          seller_id: string | null
          seller_name: string | null
          status: string
          stock_origin: string | null
          tenant_id: string
          updated_at: string | null
          vehicle_description: string | null
          vehicle_id: string | null
        }
        Insert: {
          branch_id?: string | null
          client_name?: string | null
          commission?: number | null
          commission_credit_status?: string | null
          created_at?: string | null
          delivery_date?: string | null
          down_payment?: number | null
          financing_amount?: number | null
          id?: string
          installments?: number | null
          lead_id?: string | null
          margin?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          sale_date?: string
          sale_price?: number
          seller_id?: string | null
          seller_name?: string | null
          status?: string
          stock_origin?: string | null
          tenant_id: string
          updated_at?: string | null
          vehicle_description?: string | null
          vehicle_id?: string | null
        }
        Update: {
          branch_id?: string | null
          client_name?: string | null
          commission?: number | null
          commission_credit_status?: string | null
          created_at?: string | null
          delivery_date?: string | null
          down_payment?: number | null
          financing_amount?: number | null
          id?: string
          installments?: number | null
          lead_id?: string | null
          margin?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          sale_date?: string
          sale_price?: number
          seller_id?: string | null
          seller_name?: string | null
          status?: string
          stock_origin?: string | null
          tenant_id?: string
          updated_at?: string | null
          vehicle_description?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_app_presence: {
        Row: {
          last_path: string | null
          last_seen_at: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_path?: string | null
          last_seen_at?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_path?: string | null
          last_seen_at?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_app_presence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_app_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_follow_up_checks: {
        Row: {
          branch_id: string | null
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          follow_up_date: string
          id: string
          period: string
          seller_user_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          follow_up_date: string
          id?: string
          period: string
          seller_user_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          follow_up_date?: string
          id?: string
          period?: string
          seller_user_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_follow_up_checks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_follow_up_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_follow_up_checks_seller_user_id_fkey"
            columns: ["seller_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_follow_up_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_follow_up_notes: {
        Row: {
          branch_id: string | null
          created_at: string
          follow_up_date: string
          id: string
          note: string
          seller_user_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          follow_up_date: string
          id?: string
          note?: string
          seller_user_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          follow_up_date?: string
          id?: string
          note?: string
          seller_user_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_follow_up_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_follow_up_notes_seller_user_id_fkey"
            columns: ["seller_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_follow_up_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_follow_up_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sticky_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          id: string
          pos_x: number
          pos_y: number
          tenant_id: string
          updated_at: string
          user_id: string
          z_index: number
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          pos_x?: number
          pos_y?: number
          tenant_id: string
          updated_at?: string
          user_id: string
          z_index?: number
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          pos_x?: number
          pos_y?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "sticky_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_ia_description_examples: {
        Row: {
          content: string
          created_at: string | null
          id: string
          platform: string
          vehicle_make: string | null
          vehicle_model: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          platform?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          platform?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
        }
        Relationships: []
      }
      studio_prompts: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          system_prompt: string
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          system_prompt: string
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          system_prompt?: string
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_prompts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_quotas: {
        Row: {
          alert_threshold_pct: number
          created_at: string
          hard_stop: boolean
          monthly_budget_usd: number
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alert_threshold_pct?: number
          created_at?: string
          hard_stop?: boolean
          monthly_budget_usd?: number
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alert_threshold_pct?: number
          created_at?: string
          hard_stop?: boolean
          monthly_budget_usd?: number
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_quotas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_billing: {
        Row: {
          billing_mode: string
          created_at: string
          external_customer_id: string | null
          metadata: Json
          provider: string | null
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_mode?: string
          created_at?: string
          external_customer_id?: string | null
          metadata?: Json
          provider?: string | null
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_mode?: string
          created_at?: string
          external_customer_id?: string | null
          metadata?: Json
          provider?: string | null
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_billing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          kind: string
          tenant_id: string
          updated_at: string
          vercel_domain_id: string | null
          verification_status: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          kind: string
          tenant_id: string
          updated_at?: string
          vercel_domain_id?: string | null
          verification_status?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          kind?: string
          tenant_id?: string
          updated_at?: string
          vercel_domain_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          flag_key: string
          id: string
          payload: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          flag_key: string
          id?: string
          payload?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_key?: string
          id?: string
          payload?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string
          role: string
          status: string
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by: string
          role?: string
          status?: string
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string
          role?: string
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_sites: {
        Row: {
          about_text: string | null
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          favicon_url: string | null
          font: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_published: boolean
          logo_url: string | null
          primary_color: string
          secondary_color: string | null
          sections: Json
          seo_description: string | null
          seo_title: string | null
          site_name: string | null
          social: Json
          tenant_id: string
          theme: string
          theme_custom: Json
          updated_at: string
          videos: Json
          whatsapp_phone: string | null
        }
        Insert: {
          about_text?: string | null
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          favicon_url?: string | null
          font?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          sections?: Json
          seo_description?: string | null
          seo_title?: string | null
          site_name?: string | null
          social?: Json
          tenant_id: string
          theme?: string
          theme_custom?: Json
          updated_at?: string
          videos?: Json
          whatsapp_phone?: string | null
        }
        Update: {
          about_text?: string | null
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          favicon_url?: string | null
          font?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          sections?: Json
          seo_description?: string | null
          seo_title?: string | null
          site_name?: string | null
          social?: Json
          tenant_id?: string
          theme?: string
          theme_custom?: Json
          updated_at?: string
          videos?: Json
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ycloud_config: {
        Row: {
          api_key: string
          created_at: string
          last_error: string | null
          status: string
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
          ycloud_webhook_endpoint_id: string | null
        }
        Insert: {
          api_key: string
          created_at?: string
          last_error?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
          ycloud_webhook_endpoint_id?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string
          last_error?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
          ycloud_webhook_endpoint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ycloud_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          churned_at: string | null
          created_at: string
          data_export_requested_at: string | null
          default_monthly_sales_goal: number
          id: string
          legacy_mode: boolean
          lifecycle_status: string
          mrr_clp: number | null
          name: string
          plan: string
          protected_account_email: string | null
          seller_inactivity_hours: number
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          churned_at?: string | null
          created_at?: string
          data_export_requested_at?: string | null
          default_monthly_sales_goal?: number
          id?: string
          legacy_mode?: boolean
          lifecycle_status?: string
          mrr_clp?: number | null
          name: string
          plan?: string
          protected_account_email?: string | null
          seller_inactivity_hours?: number
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          churned_at?: string | null
          created_at?: string
          data_export_requested_at?: string | null
          default_monthly_sales_goal?: number
          id?: string
          legacy_mode?: boolean
          lifecycle_status?: string
          mrr_clp?: number | null
          name?: string
          plan?: string
          protected_account_email?: string | null
          seller_inactivity_hours?: number
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tramite_tipos: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          requires_api: boolean
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          requires_api?: boolean
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          requires_api?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      tramites: {
        Row: {
          anio: number | null
          branch_id: string | null
          completed_at: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          external_id: string | null
          id: string
          lead_id: string | null
          marca: string | null
          modelo: string | null
          notes: string | null
          patente: string | null
          result_payload: Json | null
          status: string
          tenant_id: string
          tramite_tipo_id: string | null
          updated_at: string | null
          vehicle_id: string | null
          vin: string | null
        }
        Insert: {
          anio?: number | null
          branch_id?: string | null
          completed_at?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          marca?: string | null
          modelo?: string | null
          notes?: string | null
          patente?: string | null
          result_payload?: Json | null
          status?: string
          tenant_id: string
          tramite_tipo_id?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vin?: string | null
        }
        Update: {
          anio?: number | null
          branch_id?: string | null
          completed_at?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          marca?: string | null
          modelo?: string | null
          notes?: string | null
          patente?: string | null
          result_payload?: Json | null
          status?: string
          tenant_id?: string
          tramite_tipo_id?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tramites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_tramite_tipo_id_fkey"
            columns: ["tramite_tipo_id"]
            isOneToOne: false
            referencedRelation: "tramite_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tramites_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_privacy_acceptances: {
        Row: {
          accepted_at: string
          id: string
          policy_version_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          policy_version_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          policy_version_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_privacy_acceptances_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "privacy_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_privacy_acceptances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shortcut_preferences: {
        Row: {
          shortcuts: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          shortcuts?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          shortcuts?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          crm_color: string | null
          daily_report_exempt: boolean
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          legacy_protected: boolean
          onboarding_completed: boolean | null
          phone: string | null
          role: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          crm_color?: string | null
          daily_report_exempt?: boolean
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          legacy_protected?: boolean
          onboarding_completed?: boolean | null
          phone?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          crm_color?: string | null
          daily_report_exempt?: boolean
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          legacy_protected?: boolean
          onboarding_completed?: boolean | null
          phone?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_appraisals: {
        Row: {
          anio: number | null
          branch_id: string | null
          combustible: string | null
          confianza: string | null
          created_at: string
          id: string
          marca: string | null
          modelo: string | null
          motor: string | null
          muestras: Json | null
          patente: string
          precio_maximo: number | null
          precio_mediana: number | null
          precio_minimo: number | null
          precio_promedio: number | null
          tenant_id: string
          total_muestras: number | null
          uf_valor: number | null
          user_id: string | null
        }
        Insert: {
          anio?: number | null
          branch_id?: string | null
          combustible?: string | null
          confianza?: string | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          motor?: string | null
          muestras?: Json | null
          patente: string
          precio_maximo?: number | null
          precio_mediana?: number | null
          precio_minimo?: number | null
          precio_promedio?: number | null
          tenant_id: string
          total_muestras?: number | null
          uf_valor?: number | null
          user_id?: string | null
        }
        Update: {
          anio?: number | null
          branch_id?: string | null
          combustible?: string | null
          confianza?: string | null
          created_at?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          motor?: string | null
          muestras?: Json | null
          patente?: string
          precio_maximo?: number | null
          precio_mediana?: number | null
          precio_minimo?: number | null
          precio_promedio?: number | null
          tenant_id?: string
          total_muestras?: number | null
          uf_valor?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_appraisals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_appraisals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_appraisals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_listings: {
        Row: {
          created_at: string | null
          external_id: string | null
          external_url: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          payload_sent: Json | null
          platform: string
          status: string
          tenant_id: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          payload_sent?: Json | null
          platform: string
          status?: string
          tenant_id: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          payload_sent?: Json | null
          platform?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_listings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photo_assets: {
        Row: {
          album: string
          counts_for_publish: boolean
          created_at: string
          created_by: string | null
          id: string
          is_cover: boolean
          sort_order: number
          tenant_id: string
          updated_at: string
          url: string
          vehicle_id: string
        }
        Insert: {
          album: string
          counts_for_publish?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_cover?: boolean
          sort_order?: number
          tenant_id: string
          updated_at?: string
          url: string
          vehicle_id: string
        }
        Update: {
          album?: string
          counts_for_publish?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_cover?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          url?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photo_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photo_assets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_status_events: {
        Row: {
          branch_id: string | null
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          tenant_id: string
          to_status: string
          vehicle_id: string
        }
        Insert: {
          branch_id?: string | null
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          tenant_id: string
          to_status: string
          vehicle_id: string
        }
        Update: {
          branch_id?: string | null
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          tenant_id?: string
          to_status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_status_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_status_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_status_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          arrival_date: string | null
          branch_id: string | null
          carroceria: string | null
          category: string | null
          color: string | null
          combustible_display: string | null
          condition: string | null
          consignatario_staff_id: string | null
          consignment_type: string
          cost: number | null
          created_at: string | null
          description: string | null
          documents: Json | null
          doors: number | null
          engine_number: string | null
          engine_size: string | null
          features: Json | null
          fuel_type: string | null
          id: string
          images: Json | null
          location: string | null
          make: string | null
          margin: number | null
          mileage: number | null
          model: string | null
          owner_name: string | null
          owner_phone: string | null
          patente: string | null
          price: number | null
          primary_image_url: string | null
          publicado: boolean
          publicado_web: boolean
          seats: number | null
          status: string
          status_changed_at: string | null
          tenant_id: string
          transmision_display: string | null
          transmission: string | null
          updated_at: string | null
          vin: string
          year: number | null
        }
        Insert: {
          arrival_date?: string | null
          branch_id?: string | null
          carroceria?: string | null
          category?: string | null
          color?: string | null
          combustible_display?: string | null
          condition?: string | null
          consignatario_staff_id?: string | null
          consignment_type?: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          documents?: Json | null
          doors?: number | null
          engine_number?: string | null
          engine_size?: string | null
          features?: Json | null
          fuel_type?: string | null
          id?: string
          images?: Json | null
          location?: string | null
          make?: string | null
          margin?: number | null
          mileage?: number | null
          model?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          patente?: string | null
          price?: number | null
          primary_image_url?: string | null
          publicado?: boolean
          publicado_web?: boolean
          seats?: number | null
          status?: string
          status_changed_at?: string | null
          tenant_id: string
          transmision_display?: string | null
          transmission?: string | null
          updated_at?: string | null
          vin: string
          year?: number | null
        }
        Update: {
          arrival_date?: string | null
          branch_id?: string | null
          carroceria?: string | null
          category?: string | null
          color?: string | null
          combustible_display?: string | null
          condition?: string | null
          consignatario_staff_id?: string | null
          consignment_type?: string
          cost?: number | null
          created_at?: string | null
          description?: string | null
          documents?: Json | null
          doors?: number | null
          engine_number?: string | null
          engine_size?: string | null
          features?: Json | null
          fuel_type?: string | null
          id?: string
          images?: Json | null
          location?: string | null
          make?: string | null
          margin?: number | null
          mileage?: number | null
          model?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          patente?: string | null
          price?: number | null
          primary_image_url?: string | null
          publicado?: boolean
          publicado_web?: boolean
          seats?: number | null
          status?: string
          status_changed_at?: string | null
          tenant_id?: string
          transmision_display?: string | null
          transmission?: string | null
          updated_at?: string | null
          vin?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_consignatario_staff_id_fkey"
            columns: ["consignatario_staff_id"]
            isOneToOne: false
            referencedRelation: "branch_sales_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          description: string | null
          event_key: string
          headers: Json
          id: string
          is_active: boolean
          secret: string | null
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_key: string
          headers?: Json
          id?: string
          is_active?: boolean
          secret?: string | null
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_key?: string
          headers?: Json
          id?: string
          is_active?: boolean
          secret?: string | null
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_log: {
        Row: {
          created_at: string
          endpoint_id: string | null
          error: string | null
          event_key: string
          id: string
          payload: Json | null
          request_id: number | null
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string
          endpoint_id?: string | null
          error?: string | null
          event_key: string
          id?: string
          payload?: Json | null
          request_id?: number | null
          tenant_id: string
          url: string
        }
        Update: {
          created_at?: string
          endpoint_id?: string | null
          error?: string | null
          event_key?: string
          id?: string
          payload?: Json | null
          request_id?: number | null
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_log_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_calls: {
        Row: {
          branch_id: string | null
          call_id: string
          contact_name: string | null
          contact_phone: string
          created_at: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          inbox_id: string | null
          lead_id: string | null
          notes: string | null
          provider_call_id: string | null
          raw_payload: Json | null
          recording_url: string | null
          started_at: string | null
          status: string
          tenant_id: string
          transcript: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          call_id: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string | null
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          inbox_id?: string | null
          lead_id?: string | null
          notes?: string | null
          provider_call_id?: string | null
          raw_payload?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status: string
          tenant_id: string
          transcript?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          call_id?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          inbox_id?: string | null
          lead_id?: string | null
          notes?: string | null
          provider_call_id?: string | null
          raw_payload?: Json | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          transcript?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_calls_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_calls_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_calls_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_inboxes_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_calls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbox_credentials: {
        Row: {
          access_token: string
          created_at: string
          inbox_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          inbox_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          inbox_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbox_credentials_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_inboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_credentials_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_inboxes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inboxes: {
        Row: {
          branch_id: string
          connected_at: string | null
          connected_by: string | null
          created_at: string | null
          display_number: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          provider: string
          provider_phone_number_id: string
          status: string
          tenant_id: string
          updated_at: string | null
          waba_id: string | null
        }
        Insert: {
          branch_id: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          display_number?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          provider?: string
          provider_phone_number_id: string
          status?: string
          tenant_id: string
          updated_at?: string | null
          waba_id?: string | null
        }
        Update: {
          branch_id?: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          display_number?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          provider?: string
          provider_phone_number_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inboxes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inboxes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zernio_accounts: {
        Row: {
          avatar_url: string | null
          connected_at: string
          created_at: string
          display_name: string | null
          id: string
          last_error: string | null
          platform: string
          scope: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string | null
          username: string | null
          zernio_account_id: string
        }
        Insert: {
          avatar_url?: string | null
          connected_at?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          platform: string
          scope: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
          zernio_account_id: string
        }
        Update: {
          avatar_url?: string | null
          connected_at?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          platform?: string
          scope?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
          zernio_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zernio_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zernio_org_profiles: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          zernio_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          zernio_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          zernio_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zernio_org_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zernio_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          last_error: string | null
          media_urls: Json
          platforms: Json
          published_at: string | null
          scheduled_for: string | null
          scope: string
          status: string
          tenant_id: string
          timezone: string
          updated_at: string
          vehicle_id: string | null
          zernio_post_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          last_error?: string | null
          media_urls?: Json
          platforms?: Json
          published_at?: string | null
          scheduled_for?: string | null
          scope: string
          status?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
          vehicle_id?: string | null
          zernio_post_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          last_error?: string | null
          media_urls?: Json
          platforms?: Json
          published_at?: string | null
          scheduled_for?: string | null
          scope?: string
          status?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
          vehicle_id?: string | null
          zernio_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zernio_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zernio_posts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      zernio_user_profiles: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
          zernio_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
          zernio_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          zernio_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zernio_user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      formula_crm_appointments_v: {
        Row: {
          automotora: string | null
          created_at: string | null
          email: string | null
          ends_at: string | null
          id: string | null
          ingresos_mensuales: string | null
          lead_created_at: string | null
          lead_id: string | null
          mensaje: string | null
          nombre: string | null
          origen: string | null
          resource_name: string | null
          source: string | null
          stage: string | null
          starts_at: string | null
          status: string | null
          telefono: string | null
          timezone: string | null
        }
        Relationships: []
      }
      tenant_ycloud_config_public: {
        Row: {
          api_key_configured: boolean | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          webhook_configured: boolean | null
        }
        Insert: {
          api_key_configured?: never
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          webhook_configured?: never
        }
        Update: {
          api_key_configured?: never
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          webhook_configured?: never
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ycloud_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inboxes_public: {
        Row: {
          branch_id: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string | null
          display_number: string | null
          id: string | null
          is_active: boolean | null
          last_error: string | null
          provider: string | null
          provider_phone_number_id: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          waba_id: string | null
        }
        Insert: {
          branch_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          display_number?: string | null
          id?: string | null
          is_active?: boolean | null
          last_error?: string | null
          provider?: string | null
          provider_phone_number_id?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
        }
        Update: {
          branch_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          display_number?: string | null
          id?: string | null
          is_active?: boolean | null
          last_error?: string | null
          provider?: string | null
          provider_phone_number_id?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inboxes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inboxes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      audit_rls_status: { Args: { p_tables?: string[] }; Returns: Json }
      check_rate_limit: {
        Args: {
          p_identifier: string
          p_max: number
          p_route: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      check_tenant_ai_budget: { Args: { p_tenant_id: string }; Returns: Json }
      chile_today_date: { Args: never; Returns: string }
      complete_tenant_onboarding: {
        Args: {
          p_branch_address?: string
          p_branch_city?: string
          p_branch_phone?: string
          p_branch_region?: string
          p_company_name: string
        }
        Returns: Json
      }
      consignaciones_admin_ranking: {
        Args: never
        Returns: {
          avatar_url: string
          count_publicadas: number
          count_stale: number
          count_total: number
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      current_finance_organization_id: { Args: never; Returns: string }
      current_is_legacy_protected: { Args: never; Returns: boolean }
      current_tenant_id: { Args: never; Returns: string }
      current_user_branch_id: { Args: never; Returns: string }
      current_user_can_access_lead: {
        Args: { p_lead_id: string }
        Returns: boolean
      }
      current_user_role: { Args: never; Returns: string }
      dispatch_webhook: {
        Args: { p_event_key: string; p_payload: Json; p_tenant_id: string }
        Returns: undefined
      }
      export_tenant_data_bundle: {
        Args: { p_tenant_id?: string }
        Returns: Json
      }
      formula_book_appointment: {
        Args: {
          p_automotora?: string
          p_email: string
          p_ingresos_mensuales?: string
          p_mensaje?: string
          p_nombre: string
          p_origen?: string
          p_resource_slug: string
          p_starts_at: string
          p_telefono: string
        }
        Returns: Json
      }
      formula_cancel_appointment: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      formula_get_available_slots: {
        Args: { p_date: string; p_resource_slug: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      formula_reschedule_appointment: {
        Args: { p_appointment_id: string; p_starts_at: string }
        Returns: Json
      }
      get_consignaciones_ranking: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          branch_id: string
          branch_name: string
          consignaciones_count: number
          publicadas_count: number
          seller_id: string
          seller_key: string
          seller_name: string
          vendidas_count: number
        }[]
      }
      get_sales_ranking: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: {
          branch_id: string
          branch_name: string
          is_linked_user: boolean
          sales_count: number
          seller_id: string
          seller_key: string
          seller_name: string
          total_amount: number
          total_margin: number
        }[]
      }
      get_seller_engagement_metrics: {
        Args: {
          p_branch_id?: string
          p_inactivity_hours?: number
          p_window_days?: number
        }
        Returns: {
          activities_count: number
          engagement_score: number
          is_inactive: boolean
          last_engagement_at: string
          last_seen_at: string
          lead_moves_count: number
          notes_count: number
          seller_key: string
          seller_name: string
          staff_id: string
          stale_assigned_leads: number
          user_id: string
        }[]
      }
      invite_team_member: {
        Args: { p_email: string; p_full_name?: string; p_role?: string }
        Returns: Json
      }
      is_admin_of_branch: {
        Args: { p_branch_id: string; p_user_id: string }
        Returns: boolean
      }
      lead_ingest_user_may_manage_branch: {
        Args: { p_branch_id: string }
        Returns: boolean
      }
      lead_source_display_label: { Args: { p_source: string }; Returns: string }
      list_lead_ingest_keys: { Args: { p_branch_id: string }; Returns: Json }
      mint_lead_ingest_key: {
        Args: { p_branch_id: string; p_label?: string }
        Returns: Json
      }
      pending_task_blocks_auto_create: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_metadata_contains?: Json
        }
        Returns: boolean
      }
      provision_tenant: {
        Args: {
          p_default_branch_name?: string
          p_jefe_jefe_email: string
          p_jefe_jefe_full_name: string
          p_name: string
          p_slug: string
        }
        Returns: {
          branch_id: string
          tenant_id: string
        }[]
      }
      purge_leads_from_trash: {
        Args: { p_lead_ids: string[] }
        Returns: number
      }
      resolve_notification_recipients: {
        Args: {
          p_branch_id: string
          p_exclude_user_id: string
          p_roles: string[]
          p_tenant_id: string
        }
        Returns: {
          user_branch_id: string
          user_id: string
        }[]
      }
      revoke_lead_ingest_key: { Args: { p_key_id: string }; Returns: Json }
      super_admin_ai_cost_summary: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      sync_daily_sales_report_tasks: {
        Args: { p_report_date?: string }
        Returns: {
          pending_tasks_created: number
        }[]
      }
      sync_leads_contacted_no_attempts_to_pending_tasks: {
        Args: { horas_sin_intento?: number }
        Returns: {
          pending_tasks_created: number
        }[]
      }
      sync_leads_searching_car_to_pending_tasks: {
        Args: { dias_buscando?: number }
        Returns: {
          pending_tasks_created: number
        }[]
      }
      sync_seller_inactivity_notifications: {
        Args: never
        Returns: {
          notifications_created: number
        }[]
      }
      sync_stale_consignaciones_to_pending_tasks: {
        Args: { dias_sin_publicar?: number }
        Returns: {
          notifications_created: number
          pending_tasks_created: number
        }[]
      }
      sync_stale_leads_to_pending_tasks: {
        Args: { dias_sin_movimiento?: number }
        Returns: {
          notifications_created: number
          pending_tasks_created: number
        }[]
      }
      sync_unpublished_vehicles_to_pending_tasks: {
        Args: { dias_sin_publicar?: number }
        Returns: {
          pending_tasks_created: number
        }[]
      }
      tenant_is_operational: { Args: { p_tenant_id: string }; Returns: boolean }
      update_branch_sales_staff_profile: {
        Args: { p_branch_id?: string; p_full_name: string; p_staff_id: string }
        Returns: Json
      }
      upsert_seller_app_presence: {
        Args: { p_path?: string }
        Returns: undefined
      }
      user_can_access_formula_crm: { Args: never; Returns: boolean }
      user_may_access_finance_module: { Args: never; Returns: boolean }
      vehicle_status_display_label: {
        Args: { p_status: string }
        Returns: string
      }
      verify_lead_ingest_key: {
        Args: { p_branch_id: string; p_key: string }
        Returns: Json
      }
      warm_edge_functions: { Args: never; Returns: undefined }
    }
    Enums: {
      formula_billing_cycle: "mensual" | "trimestral" | "anual" | "pago_unico"
      formula_payment_status: "al_dia" | "pendiente" | "atrasado"
      formula_student_status: "activo" | "pausa" | "completado" | "baja"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      formula_billing_cycle: ["mensual", "trimestral", "anual", "pago_unico"],
      formula_payment_status: ["al_dia", "pendiente", "atrasado"],
      formula_student_status: ["activo", "pausa", "completado", "baja"],
    },
  },
} as const
