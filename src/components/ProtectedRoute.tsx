import DashboardLoader from '@/components/DashboardLoader'
import { useAuth } from '@/contexts/AuthContext'
import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: string[]
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, isSigningOut, needsOnboarding } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <DashboardLoader
        message={isSigningOut ? "Cerrando sesión..." : "Cargando..."}
        barLabel={isSigningOut ? "Cerrando sesión" : "Cargando"}
      />
    )
  }

  if (!user) {
    console.log('ProtectedRoute - Usuario no autenticado, redirigiendo a landing')
    return <Navigate to="/" state={{ from: location }} replace />
  }

  // Onboarding desactivado temporalmente
  // Si el usuario necesita onboarding y no está en la página de onboarding, redirigir
  // if (needsOnboarding && location.pathname !== '/onboarding') {
  //   console.log('ProtectedRoute - Usuario necesita onboarding, redirigiendo a /onboarding')
  //   return <Navigate to="/onboarding" replace />
  // }

  // Si el usuario ya completó el onboarding y está en la página de onboarding, redirigir al dashboard
  if (!needsOnboarding && location.pathname === '/onboarding') {
    console.log('ProtectedRoute - Onboarding desactivado, redirigiendo a /app')
    return <Navigate to="/app" replace />
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    console.log('ProtectedRoute - Usuario no tiene rol requerido, redirigiendo a /app')
    return <Navigate to="/app" replace />
  }

  console.log('ProtectedRoute - Acceso permitido')
  return <>{children}</>
}
