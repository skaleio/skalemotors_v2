import { useState, useEffect } from 'react';
import { User, Mail, Phone, Save, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
  const { user, fetchUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: '',
  });

  // Cargar datos del usuario al montar el componente
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        email: user.email || '',
        role: user.role || '',
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Limpiar mensajes al cambiar valores
    if (error) setError('');
    if (success) setSuccess(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!user?.id) {
        throw new Error('No hay usuario autenticado');
      }

      // Validar que el nombre no esté vacío
      if (!formData.full_name.trim()) {
        throw new Error('El nombre completo es requerido');
      }

      // Actualizar perfil en la base de datos
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error actualizando perfil:', updateError);
        throw new Error(updateError.message || 'Error al actualizar el perfil');
      }

      // Actualizar también en auth.users metadata si es posible
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
        }
      });

      if (authError) {
        console.warn('No se pudo actualizar metadata de auth:', authError);
        // No es crítico, continuamos
      }

      // Recargar el perfil del usuario para actualizar el estado global
      // Esto actualizará automáticamente el nombre en TopBar y AppSidebar
      await fetchUserProfile(user.id);
      
      // Pequeño delay para asegurar que el estado se propague
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Actualizar también el formulario local con los datos guardados
      setFormData(prev => ({
        ...prev,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || '',
      }));

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error en handleUpdateProfile:', err);
      setError(err.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrador',
      gerente: 'Gerente',
      vendedor: 'Vendedor',
      financiero: 'Financiero',
      servicio: 'Servicio',
      inventario: 'Inventario',
    };
    return roles[role] || role;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando información del usuario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona tu información personal y preferencias de cuenta
        </p>
      </div>

      <div className="grid gap-6">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información del Perfil
            </CardTitle>
            <CardDescription>
              Actualiza tu información personal. Estos datos se utilizarán en todo el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-500 bg-green-50 text-green-900">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Perfil actualizado exitosamente
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                {/* Nombre Completo */}
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nombre Completo *
                  </Label>
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {/* Teléfono */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Teléfono
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Email (solo lectura) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Correo Electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    El correo electrónico no se puede cambiar desde aquí
                  </p>
                </div>

                {/* Rol (solo lectura) */}
                <div className="space-y-2">
                  <Label htmlFor="role" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Rol
                  </Label>
                  <Input
                    id="role"
                    type="text"
                    value={getRoleLabel(formData.role)}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    El rol es asignado por un administrador
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
