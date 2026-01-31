import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

// Usar variables de entorno (NO hardcodear keys en el repo)
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env",
  )
}

// Crear cliente de Supabase con tipos
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'skale-motors-web'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Tipos para TypeScript
export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  role: 'admin' | 'gerente' | 'vendedor' | 'financiero' | 'servicio' | 'inventario'
  branch_id?: string
  is_active: boolean
  avatar_url?: string
  onboarding_completed?: boolean
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  name: string
  address: string
  phone?: string
  email?: string
  manager_id?: string
  city: string
  region: string
  is_active: boolean
  created_at: string
  updated_at: string
}
