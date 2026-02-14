import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Save, AlertCircle, CheckCircle, Lock, Camera, Trash2, Building2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Database } from '@/lib/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { optimizeAvatarFile } from '@/lib/avatar-utils';
import { Separator } from '@/components/ui/separator';
import { ProfileAvatarImage } from '@/components/ProfileAvatarImage';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CREATE_BRANCH_OPTION_VALUE = '__create_branch__';

export default function Settings() {
  const { user, fetchUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: '',
    branch_id: '' as string,
  });
  const [currentBranchName, setCurrentBranchName] = useState<string | null>(null);
  const [newBranch, setNewBranch] = useState({
    name: '',
    address: '',
    city: '',
    region: '',
    opening_hours: '',
    phone: '',
    email: '',
  });
  const [savingBranch, setSavingBranch] = useState(false);
  const [createBranchDialogOpen, setCreateBranchDialogOpen] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string; city: string; region: string }[]>([]);
  const [editBranchDialogOpen, setEditBranchDialogOpen] = useState(false);
  const [editBranchLoading, setEditBranchLoading] = useState(false);
  const [editBranchSaving, setEditBranchSaving] = useState(false);
  const [editBranchForm, setEditBranchForm] = useState({
    name: '',
    address: '',
    city: '',
    region: '',
    phone: '',
    email: '',
    opening_hours: '',
  });

  // Cargar lista de sucursales desde Supabase
  useEffect(() => {
    const loadBranches = async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, city, region')
        .order('name');
      if (!error && data) setBranches(data);
    };
    loadBranches();
  }, []);

  // Cargar nombre de la sucursal actual si el usuario tiene una asignada
  useEffect(() => {
    if (!user?.branch_id) {
      setCurrentBranchName(null);
      return;
    }
    const branch = branches.find((b) => b.id === user.branch_id);
    if (branch) {
      setCurrentBranchName(branch.name);
      return;
    }
    let cancelled = false;
    supabase
      .from('branches')
      .select('name')
      .eq('id', user.branch_id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setCurrentBranchName(data.name);
      })
      .catch(() => {
        if (!cancelled) setCurrentBranchName(null);
      });
    return () => { cancelled = true; };
  }, [user?.branch_id, branches]);

  // Cargar datos del usuario al montar el componente
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        email: user.email || '',
        role: user.role || '',
        branch_id: user.branch_id || '',
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

      // Actualizar perfil en la base de datos (incluye sucursal)
      const updatePayload: Database['public']['Tables']['users']['Update'] = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || null,
        branch_id: formData.branch_id.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from('users')
        // @ts-expect-error - Supabase generated types infer never for update in this setup
        .update(updatePayload)
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
          branch_id: formData.branch_id.trim() || null,
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
        branch_id: formData.branch_id.trim() || '',
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

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!newBranch.name.trim() || !newBranch.address.trim() || !newBranch.city.trim() || !newBranch.region.trim()) {
      setError('Nombre, dirección, ciudad y región son obligatorios.');
      return;
    }
    setSavingBranch(true);
    setError('');
    setSuccess(false);
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('branches')
        .insert({
          name: newBranch.name.trim(),
          address: newBranch.address.trim(),
          city: newBranch.city.trim(),
          region: newBranch.region.trim(),
          opening_hours: newBranch.opening_hours.trim() || null,
          phone: newBranch.phone.trim() || null,
          email: newBranch.email.trim() || null,
          is_active: true,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      if (!inserted?.id) throw new Error('No se creó la sucursal');
      const userUpdatePayload: Database['public']['Tables']['users']['Update'] = {
        branch_id: inserted.id,
        updated_at: new Date().toISOString(),
      };
      const { error: updateErr } = await supabase
        .from('users')
        // @ts-expect-error - Supabase generated types infer never for update in this setup
        .update(userUpdatePayload)
        .eq('id', user.id);
      if (updateErr) throw updateErr;
      await supabase.auth.updateUser({
        data: { branch_id: inserted.id },
      });
      await fetchUserProfile(user.id);
      setFormData((prev) => ({ ...prev, branch_id: inserted.id }));
      setCurrentBranchName(newBranch.name.trim());
      setNewBranch({ name: '', address: '', city: '', region: '', opening_hours: '', phone: '', email: '' });
      setCreateBranchDialogOpen(false);
      // Refrescar lista de sucursales para que aparezca la nueva
      const { data: refreshed } = await supabase.from('branches').select('id, name, city, region').order('name');
      if (refreshed) setBranches(refreshed);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Error al crear la sucursal');
    } finally {
      setSavingBranch(false);
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

  const openEditBranchDialog = async () => {
    if (!formData.branch_id) return;
    setEditBranchLoading(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, city, region, phone, email, opening_hours')
        .eq('id', formData.branch_id)
        .single();
      if (error || !data) throw new Error(error?.message || 'No se pudo cargar la sucursal');
      setEditBranchForm({
        name: data.name ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        region: data.region ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        opening_hours: (data as { opening_hours?: string | null }).opening_hours ?? '',
      });
      setEditBranchDialogOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar la sucursal');
    } finally {
      setEditBranchLoading(false);
    }
  };

  const handleSaveEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branch_id) return;
    if (!editBranchForm.name.trim() || !editBranchForm.address.trim() || !editBranchForm.city.trim() || !editBranchForm.region.trim()) {
      setError('Nombre, dirección, ciudad y región son obligatorios.');
      return;
    }
    setEditBranchSaving(true);
    setError('');
    try {
      const payload: Database['public']['Tables']['branches']['Update'] = {
        name: editBranchForm.name.trim(),
        address: editBranchForm.address.trim(),
        city: editBranchForm.city.trim(),
        region: editBranchForm.region.trim(),
        phone: editBranchForm.phone.trim() || null,
        email: editBranchForm.email.trim() || null,
        opening_hours: editBranchForm.opening_hours.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error: updateErr } = await supabase
        .from('branches')
        // @ts-expect-error - Supabase generated types infer never for update in this setup
        .update(payload)
        .eq('id', formData.branch_id);
      if (updateErr) throw updateErr;
      setCurrentBranchName(editBranchForm.name.trim());
      const { data: refreshed } = await supabase.from('branches').select('id, name, city, region').order('name');
      if (refreshed) setBranches(refreshed);
      setEditBranchDialogOpen(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar la sucursal');
    } finally {
      setEditBranchSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Formato no válido. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_MB * 1024 * 1024) {
      setError(`La imagen no debe superar ${AVATAR_MAX_SIZE_MB} MB.`);
      return;
    }
    setAvatarUploading(true);
    setError('');
    setSuccess(false);
    try {
      const optimized = await optimizeAvatarFile(file);
      const path = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, optimized, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUpdate: Database['public']['Tables']['users']['Update'] = {
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from('users')
        // @ts-expect-error - Supabase generated types infer never for update in this setup
        .update(avatarUpdate)
        .eq('id', user.id);
      if (updateError) throw updateError;
      await fetchUserProfile(user.id);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Error al subir la imagen de perfil.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id) return;
    setAvatarUploading(true);
    setError('');
    try {
      const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(user.id);
      if (files?.length) {
        const toRemove = files.map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from(AVATAR_BUCKET).remove(toRemove);
      }
      const removeAvatarUpdate: Database['public']['Tables']['users']['Update'] = {
        avatar_url: null,
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from('users')
        // @ts-expect-error - Supabase generated types infer never for update in this setup
        .update(removeAvatarUpdate)
        .eq('id', user.id);
      if (updateError) throw updateError;
      await fetchUserProfile(user.id);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Error al quitar la imagen de perfil.');
    } finally {
      setAvatarUploading(false);
    }
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

              {/* Imagen de perfil */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Avatar className="h-20 w-20 shrink-0">
                  <ProfileAvatarImage
                    avatarUrl={user?.avatar_url}
                    size={128}
                    cacheKey={user?.updated_at}
                    alt="Tu foto de perfil"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                    {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_TYPES.join(',')}
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={avatarUploading || loading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarUploading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Subiendo...
                      </span>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Cambiar imagen
                      </>
                    )}
                  </Button>
                  {user?.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={avatarUploading || loading}
                      onClick={handleRemoveAvatar}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Quitar imagen
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o WebP. Máx. {AVATAR_MAX_SIZE_MB} MB. La imagen se verá en el menú lateral.
                </p>
              </div>

              <Separator />

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

                {/* Sucursal: elegir existente o crear nueva */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Sucursal
                  </Label>
                  <Select
                    value={formData.branch_id === CREATE_BRANCH_OPTION_VALUE ? 'none' : (formData.branch_id || 'none')}
                    onValueChange={(v) => {
                      if (v === CREATE_BRANCH_OPTION_VALUE) {
                        setNewBranch({ name: '', address: '', city: '', region: '', opening_hours: '', phone: '', email: '' });
                        setCreateBranchDialogOpen(true);
                        return;
                      }
                      handleInputChange('branch_id', v === 'none' ? '' : v);
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin sucursal</SelectItem>
                      {(user?.role === 'admin' || user?.role === 'gerente' || branches.length === 0) && (
                        <SelectItem value={CREATE_BRANCH_OPTION_VALUE}>Crear sucursal</SelectItem>
                      )}
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} {b.city ? `(${b.city})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.branch_id && (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <span className="text-sm flex-1">
                        Sucursal actual: <strong>{currentBranchName ?? '…'}</strong>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={openEditBranchDialog}
                        disabled={editBranchLoading}
                        title="Editar sucursal"
                      >
                        {editBranchLoading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    La sucursal se guarda al hacer clic en &quot;Guardar cambios&quot; más abajo.
                  </p>

                  {/* Modal editar sucursal */}
                  <Dialog open={editBranchDialogOpen} onOpenChange={setEditBranchDialogOpen}>
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Editar sucursal</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSaveEditBranch} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_branch_name">Nombre *</Label>
                          <Input
                            id="edit_branch_name"
                            value={editBranchForm.name}
                            onChange={(e) => setEditBranchForm((b) => ({ ...b, name: e.target.value }))}
                            placeholder="Ej. Sucursal Centro"
                            disabled={editBranchSaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_branch_address">Dirección *</Label>
                          <Input
                            id="edit_branch_address"
                            value={editBranchForm.address}
                            onChange={(e) => setEditBranchForm((b) => ({ ...b, address: e.target.value }))}
                            placeholder="Calle y número"
                            disabled={editBranchSaving}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="edit_branch_city">Ciudad *</Label>
                            <Input
                              id="edit_branch_city"
                              value={editBranchForm.city}
                              onChange={(e) => setEditBranchForm((b) => ({ ...b, city: e.target.value }))}
                              placeholder="Santiago"
                              disabled={editBranchSaving}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit_branch_region">Región *</Label>
                            <Input
                              id="edit_branch_region"
                              value={editBranchForm.region}
                              onChange={(e) => setEditBranchForm((b) => ({ ...b, region: e.target.value }))}
                              placeholder="Metropolitana"
                              disabled={editBranchSaving}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_branch_hours">Horario de atención</Label>
                          <Input
                            id="edit_branch_hours"
                            value={editBranchForm.opening_hours}
                            onChange={(e) => setEditBranchForm((b) => ({ ...b, opening_hours: e.target.value }))}
                            placeholder="Ej. Lun-Vie 9:00-18:00, Sáb 9:00-13:00"
                            disabled={editBranchSaving}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="edit_branch_phone">Teléfono</Label>
                            <Input
                              id="edit_branch_phone"
                              value={editBranchForm.phone}
                              onChange={(e) => setEditBranchForm((b) => ({ ...b, phone: e.target.value }))}
                              placeholder="Opcional"
                              disabled={editBranchSaving}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit_branch_email">Email</Label>
                            <Input
                              id="edit_branch_email"
                              type="email"
                              value={editBranchForm.email}
                              onChange={(e) => setEditBranchForm((b) => ({ ...b, email: e.target.value }))}
                              placeholder="Opcional"
                              disabled={editBranchSaving}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditBranchDialogOpen(false)}
                            disabled={editBranchSaving}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={editBranchSaving}>
                            {editBranchSaving ? (
                              <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Guardando...
                              </span>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Modal crear sucursal (se abre al elegir "Crear sucursal" en el dropdown) */}
                  <Dialog open={createBranchDialogOpen} onOpenChange={setCreateBranchDialogOpen}>
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Crear sucursal</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddBranch} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="branch_name">Nombre *</Label>
                          <Input
                            id="branch_name"
                            value={newBranch.name}
                            onChange={(e) => setNewBranch((b) => ({ ...b, name: e.target.value }))}
                            placeholder="Ej. Sucursal Centro"
                            disabled={savingBranch}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="branch_address">Dirección *</Label>
                          <Input
                            id="branch_address"
                            value={newBranch.address}
                            onChange={(e) => setNewBranch((b) => ({ ...b, address: e.target.value }))}
                            placeholder="Calle y número"
                            disabled={savingBranch}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="branch_city">Ciudad *</Label>
                            <Input
                              id="branch_city"
                              value={newBranch.city}
                              onChange={(e) => setNewBranch((b) => ({ ...b, city: e.target.value }))}
                              placeholder="Santiago"
                              disabled={savingBranch}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="branch_region">Región *</Label>
                            <Input
                              id="branch_region"
                              value={newBranch.region}
                              onChange={(e) => setNewBranch((b) => ({ ...b, region: e.target.value }))}
                              placeholder="Metropolitana"
                              disabled={savingBranch}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="branch_hours">Horario de atención</Label>
                          <Input
                            id="branch_hours"
                            value={newBranch.opening_hours}
                            onChange={(e) => setNewBranch((b) => ({ ...b, opening_hours: e.target.value }))}
                            placeholder="Ej. Lun-Vie 9:00-18:00, Sáb 9:00-13:00"
                            disabled={savingBranch}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="branch_phone">Teléfono</Label>
                            <Input
                              id="branch_phone"
                              value={newBranch.phone}
                              onChange={(e) => setNewBranch((b) => ({ ...b, phone: e.target.value }))}
                              placeholder="Opcional"
                              disabled={savingBranch}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="branch_email">Email</Label>
                            <Input
                              id="branch_email"
                              type="email"
                              value={newBranch.email}
                              onChange={(e) => setNewBranch((b) => ({ ...b, email: e.target.value }))}
                              placeholder="Opcional"
                              disabled={savingBranch}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCreateBranchDialogOpen(false)}
                            disabled={savingBranch}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={savingBranch}>
                            {savingBranch ? (
                              <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Creando...
                              </span>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Crear sucursal y asignarme
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
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
