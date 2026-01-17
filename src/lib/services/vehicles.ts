import { supabase } from '../supabase'
import type { Database } from '../types/database'

type Vehicle = Database['public']['Tables']['vehicles']['Row']
type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']

export const vehicleService = {
  // Obtener todos los vehículos
  async getAll(filters?: {
    branchId?: string
    status?: string
    category?: string
    search?: string
  }) {
    let query = supabase
      .from('vehicles')
      .select('*, branches(name, city, region)')
      .order('created_at', { ascending: false })

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.search) {
      query = query.or(
        `make.ilike.%${filters.search}%,model.ilike.%${filters.search}%,vin.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query

    if (error) throw error
    return data as Vehicle[]
  },

  // Obtener un vehículo por ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, branches(name, city, region)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Vehicle
  },

  // Crear un nuevo vehículo
  async create(vehicle: VehicleInsert) {
    // Limpiar campos undefined
    const cleanVehicle = Object.fromEntries(
      Object.entries(vehicle).filter(([_, v]) => v !== undefined)
    ) as VehicleInsert;
    
    console.log("📤 Insertando vehículo...");
    console.log("📤 Datos:", JSON.stringify(cleanVehicle, null, 2));
    
    // Verificar sesión
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      console.error("❌ Error de sesión:", sessionError);
      throw new Error("No hay sesión activa. Por favor, inicia sesión nuevamente.");
    }
    
    // Usar el cliente de Supabase directamente (más confiable que fetch)
    const { data, error } = await supabase
      .from('vehicles')
      .insert(cleanVehicle)
      .select('*, branches(name, city, region)')
      .single();
    
    if (error) {
      console.error("❌ Error creando vehículo:", error);
      console.error("❌ Detalles:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Mensaje de error más amigable
      let errorMessage = "Error al crear el vehículo";
      if (error.code === '23505') {
        errorMessage = "Ya existe un vehículo con este VIN";
      } else if (error.code === '42501') {
        errorMessage = "No tienes permisos para crear vehículos. Contacta al administrador.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
    
    if (!data) {
      throw new Error("No se recibió respuesta válida del servidor");
    }
    
    console.log("✅ Vehículo creado exitosamente:", data.id);
    return data as Vehicle;
  },

  // Actualizar un vehículo
  async update(id: string, updates: VehicleUpdate) {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Vehicle
  },

  // Eliminar un vehículo
  async delete(id: string) {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Subir imagen de vehículo
  async uploadImage(vehicleId: string, file: File) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${vehicleId}/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('vehicles')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('vehicles')
      .getPublicUrl(fileName)

    // Actualizar vehículo con nueva imagen
    const vehicle = await this.getById(vehicleId)
    const images = (vehicle.images as string[]) || []
    images.push(publicUrl)

    return this.update(vehicleId, { images: images as any })
  },

  // Obtener estadísticas de inventario
  async getInventoryStats(branchId?: string) {
    let query = supabase
      .from('vehicles')
      .select('status, category, price')

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw error

    const stats = {
      total: data.length,
      available: data.filter(v => v.status === 'disponible').length,
      reserved: data.filter(v => v.status === 'reservado').length,
      sold: data.filter(v => v.status === 'vendido').length,
      totalValue: data.reduce((sum, v) => sum + Number(v.price || 0), 0),
      byCategory: {
        nuevo: data.filter(v => v.category === 'nuevo').length,
        usado: data.filter(v => v.category === 'usado').length,
        consignado: data.filter(v => v.category === 'consignado').length
      }
    }

    return stats
  }
}


