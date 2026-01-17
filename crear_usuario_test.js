// =====================================================
// SCRIPT PARA CREAR USUARIO DE PRUEBA
// test@skale.io con contraseña 12345
// =====================================================

const { createClient } = require('@supabase/supabase-js')

// Configuración de Supabase (NO hardcodear keys)
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan env vars: SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  console.error('Ejemplo (PowerShell):')
  console.error('$env:SUPABASE_URL="https://TU.supabase.co"')
  console.error('$env:SUPABASE_SERVICE_ROLE_KEY="TU_SB_SECRET_O_SERVICE_ROLE"')
  process.exit(1)
}

// Crear cliente con service key para operaciones de administración
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function crearUsuarioTest() {
  try {
    console.log('🚀 Creando usuario de prueba: test@skale.io')
    
    // Crear usuario en auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@skale.io',
      password: '12345',
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: {
        full_name: 'Usuario Test',
        role: 'admin'
      }
    })

    if (authError) {
      console.error('❌ Error creando usuario en auth:', authError)
      return
    }

    console.log('✅ Usuario creado en auth.users:', authData.user.id)
    
    // Verificar que el trigger creó el usuario en public.users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@skale.io')
      .single()

    if (userError) {
      console.error('❌ Error verificando usuario en public.users:', userError)
      return
    }

    console.log('✅ Usuario verificado en public.users:', userData)
    console.log('🎉 Usuario test@skale.io creado exitosamente!')
    console.log('📧 Email: test@skale.io')
    console.log('🔑 Contraseña: 12345')
    console.log('👤 Rol: admin')
    console.log('🏢 Sucursal: Sucursal Principal')

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

// Ejecutar el script
crearUsuarioTest()



