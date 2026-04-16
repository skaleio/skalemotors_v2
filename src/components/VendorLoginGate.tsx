import { useState } from "react";
import { Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function VendorLoginGate({
  title = "Acceso de vendedor",
  description = "Inicia sesión con tu usuario para ver tu CRM personal.",
  afterLoginPath = "/app/crm",
}: {
  title?: string;
  description?: string;
  afterLoginPath?: string;
}) {
  const navigate = useNavigate();
  const { signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
      return;
    }
    navigate(afterLoginPath, { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border border-white/20 bg-white/10 backdrop-blur-md">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center text-white">{title}</CardTitle>
            <CardDescription className="text-center text-white/90">{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="vendor-email" className="text-white font-medium">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                  <Input
                    id="vendor-email"
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
                <Label htmlFor="vendor-password" className="text-white font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-white/70" />
                  <Input
                    id="vendor-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 border-white/30 focus:border-white/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/60"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3 h-4 w-4 text-white/70 hover:text-white"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-medium py-2.5 transition-colors"
                  disabled={loading}
                >
                  {loading ? "Iniciando sesión..." : "Entrar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => void signOut().then(() => navigate("/login", { replace: true }))}
                  disabled={loading}
                  title="Cerrar sesión actual"
                >
                  Salir
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

