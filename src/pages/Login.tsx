import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { OptimizedStarsBackground } from '@/components/OptimizedStarsBackground'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, loading: authLoading, user } = useAuth()
  const navigate = useNavigate()
  
  // Si el usuario ya está autenticado, redirigir
  useEffect(() => {
    if (user && !authLoading) {
      console.log('✅ Usuario ya autenticado, redirigiendo...')
      navigate('/app', { replace: true })
    }
  }, [user, authLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalLoading(true)
    setError('')

    try {
      console.log('🚀 Iniciando proceso de login...')
      const { error } = await signIn(email, password)
      
      if (error) {
        console.error('❌ Error en signIn:', error)
        const errorMessage = error instanceof Error ? error.message : 
                            (typeof error === 'object' && error !== null && 'message' in error) 
                              ? String(error.message) 
                              : String(error)
        setError(errorMessage)
        setLocalLoading(false)
      }
      // Si no hay error, el useEffect redirigirá cuando user esté disponible
    } catch (error) {
      console.error('❌ Error en login (catch):', error)
      setError(error instanceof Error ? error.message : 'Error inesperado. Intenta nuevamente.')
      setLocalLoading(false)
    }
  }
  
  // Resetear loading cuando el usuario esté disponible o authLoading cambie
  useEffect(() => {
    if (user || !authLoading) {
      setLocalLoading(false)
    }
  }, [user, authLoading])

  return (
    <div className="min-h-screen relative">
      <OptimizedStarsBackground className="fixed inset-0 z-0" starColor="#87CEEB" factor={0.02} speed={100} transition={{ stiffness: 30, damping: 15 }} />
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
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium py-2.5 transition-colors"
                disabled={localLoading || authLoading}
              >
                {(localLoading || authLoading) ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-white/80">
                ¿No tienes una cuenta?{' '}
                <Link
                  to="/register"
                  className="text-white hover:text-white/80 font-medium transition-colors"
                >
                  Regístrate aquí
                </Link>
              </p>
            </div>
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