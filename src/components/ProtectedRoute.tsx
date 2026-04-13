import DashboardLoader from '@/components/DashboardLoader'
import { useAuth } from '@/contexts/AuthContext'
import { type AppPermission, hasPermission } from '@/lib/rbac'
import { ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: string[]
  requiredPermission?: AppPermission
}

export default function ProtectedRoute({ children, requiredRole, requiredPermission }: ProtectedRouteProps) {
  const { user, loading, isSigningOut, needsOnboarding, signOut } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (user && !user.is_active) {
      void signOut()
    }
  }, [user, signOut])

  if (loading) {
    return (
      <DashboardLoader
        message={isSigningOut ? "Cerrando sesión..." : "Cargando..."}
        barLabel={isSigningOut ? "Cerrando sesión" : "Cargando"}
      />
    )
  }

  if (!user || !user.is_active) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  if (!needsOnboarding && location.pathname === '/onboarding') {
    return <Navigate to="/app" replace />
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Navigate to="/app" replace />
  }

  if (requiredPermission && !hasPermission(user.role, requiredPermission)) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
