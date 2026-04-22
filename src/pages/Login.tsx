// Login page — flujo simplificado: signIn clásico + prefetch CRM + legacy-safe redirect.
import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, type Location as RouterLocation } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { StaticLoginBackground } from '@/components/StaticLoginBackground'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginCooldown, setLoginCooldown] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { signIn, loading: authLoading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  // Prefetch del chunk post-login más probable: CRM (para vendedores).
  // Dashboard es estático (ya está en bundle principal). Solo precargamos
  // CRM porque es el primer destino del 80% de logins (vendedores). El resto
  // se lazy-loadea natural al navegar. Se dispara en idle para no competir
  // con el render del Login.
  useEffect(() => {
    const idle = (cb: () => void) =>
      (window as Window & { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback?.(cb) ?? window.setTimeout(cb, 400);
    idle(() => {
      void import('./CRM').catch(() => {});
    });
  }, [])

  const startCooldown = (seconds: number) => {
    setLoginCooldown(seconds)
    cooldownRef.current = setInterval(() => {
      setLoginCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const [loginAttempted, setLoginAttempted] = useState(false)

  const getErrorMessage = (attempts: number, err?: unknown): string => {
    if (err instanceof Error && err.message === 'ACCOUNT_DISABLED') {
      return 'Tu cuenta ha sido desactivada. Contacta al administrador.'
    }
    if (err instanceof Error && err.message === 'NO_PROFILE') {
      return 'Tu cuenta no tiene acceso configurado. Contacta al administrador.'
    }
    if (attempts >= 5) return 'Demasiados intentos fallidos. Espera antes de intentar nuevamente.'
    return 'Credenciales incorrectas. Verifica tu correo y contraseña.'
  }
  
  // Solo redirigir si el usuario tiene sesion valida Y no estamos en medio de un intento de login
  useEffect(() => {
    if (user && !authLoading && !localLoading && !loginAttempted) {
      const from = (location.state as { from?: RouterLocation } | null)?.from
      const defaultPath = user.role === "vendedor" ? "/app/crm" : "/app"
      const to = from?.pathname ? `${from.pathname}${from.search || ""}${from.hash || ""}` : defaultPath
      navigate(to, { replace: true })
    }
  }, [user, authLoading, localLoading, loginAttempted, navigate, location.state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loginCooldown > 0) return
    setLoginAttempted(true)
    setLocalLoading(true)
    setError('')

    try {
      const { error, role } = await signIn(email, password)

      if (error) {
        const isTerminal = error instanceof Error && (error.message === 'ACCOUNT_DISABLED' || error.message === 'NO_PROFILE')
        const newAttempts = isTerminal ? failedAttempts : failedAttempts + 1
        setFailedAttempts(newAttempts)
        if (!isTerminal) {
          const cooldownSeconds = newAttempts >= 5 ? 60 : newAttempts >= 3 ? 15 : 0
          if (cooldownSeconds > 0) startCooldown(cooldownSeconds)
        }
        setError(getErrorMessage(newAttempts, error))
        setLocalLoading(false)
        setLoginAttempted(false)
      } else {
        setFailedAttempts(0)
        // Login exitoso: redirigir según rol (vendedor → CRM, resto → dashboard)
        const from = (location.state as { from?: RouterLocation } | null)?.from
        const defaultPath = role === "vendedor" ? "/app/crm" : "/app"
        const to = from?.pathname ? `${from.pathname}${from.search || ""}${from.hash || ""}` : defaultPath
        navigate(to, { replace: true })
      }
    } catch {
      setError('Error inesperado. Intenta nuevamente.')
      setLocalLoading(false)
      setLoginAttempted(false)
    }
  }

  const buttonLabel = loginCooldown > 0
    ? `Espera ${loginCooldown}s`
    : localLoading
      ? "Iniciando sesión..."
      : "Iniciar Sesión"
  
  useEffect(() => {
    if (!authLoading && !localLoading) {
      setLocalLoading(false)
    }
  }, [authLoading])

  return (
    <div className="min-h-screen relative">
      <StaticLoginBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <button 
              onClick={() => navigate('/')}
              className="text-white hover:opacity-80 transition-opacity"
            >
              <span className="text-4xl font-bold">SKALEMOTORS</span>
            </button>
          </div>
        </div>

        <Card className="shadow-2xl border border-white/20 bg-white/10 backdrop-blur-md">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center text-white">Iniciar Sesión</CardTitle>
            <CardDescription className="text-center text-white/90">
              Ingresa a tu cuenta para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white font-medium">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-white/30 focus:border-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white font-medium">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 border-white/30 focus:border-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-white/70 hover:text-white"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link
                  to="/forgot-password"
                  className="text-sm text-white/80 hover:text-white transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-medium py-2.5 transition-colors"
                disabled={localLoading || loginCooldown > 0}
              >
                {localLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    <span>{buttonLabel}</span>
                  </span>
                ) : (
                  buttonLabel
                )}
              </Button>
            </form>

          </CardContent>
        </Card>

        {/* Información adicional */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/75">
            © 2024 SKALE. Todos los derechos reservados.
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}