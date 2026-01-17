import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: string[]
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, needsOnboarding } = useAuth()
  const location = useLocation()

  console.log('ProtectedRoute - Estado actual:', {
    user: user ? 'existe' : 'no existe',
    loading,
    needsOnboarding,
    currentPath: location.pathname
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('ProtectedRoute - Usuario no autenticado, redirigiendo a login')
    return <Navigate to="/login" state={{ from: location }} replace />
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
