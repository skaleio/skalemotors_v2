import { Navigate } from 'react-router-dom'

// Registro público deshabilitado por política de seguridad:
// - Admins se dan de alta por invitación manual.
// - Vendedores se crean desde Usuarios (Edge Function vendor-user-create).
// Para rehabilitar: restaurar el formulario original y activar signups en Supabase Auth.
export default function Register() {
  return <Navigate to="/login" replace />
}
