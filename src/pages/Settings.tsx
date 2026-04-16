import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Save, AlertCircle, CheckCircle, Lock, Camera, Trash2, Building2, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { LeadIngestApiKeysSection } from '@/components/settings/LeadIngestApiKeysSection';

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Pueden elegir otra sucursal del tenant y crear sucursales desde Configuración */
const ROLES_CAN_MANAGE_BRANCH_PICKER = new Set(['admin', 'jefe_jefe']);

function optionalBranchText(value: string): string | null {
  const t = value.trim();
  return t === '' ? null : t;
}

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
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchPickerLoading, setBranchPickerLoading] = useState(false);
  const [branchPickerApplying, setBranchPickerApplying] = useState(false);
  const [tenantBranchesList, setTenantBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [pickerBranchId, setPickerBranchId] = useState<string>('');

  const canManageOrgBranches = user ? ROLES_CAN_MANAGE_BRANCH_PICKER.has(user.role) : false;

  // Cargar nombre de la sucursal actual si el usuario tiene una asignada
  useEffect(() => {
    if (!user?.branch_id) {
      setCurrentBranchName(null);
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
  }, [user?.branch_id]);

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
    if (!newBranch.name.trim()) {
      setError('El nombre de la sucursal es obligatorio.');
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
          address: optionalBranchText(newBranch.address),
          city: optionalBranchText(newBranch.city),
          region: optionalBranchText(newBranch.region),
          opening_hours: newBranch.opening_hours.trim() || null,
          phone: newBranch.phone.trim() || null,
          email: newBranch.email.trim() || null,
          is_active: true,
          tenant_id: user.tenant_id ?? null,
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
      setSuccess(true);
      toast.success('Sucursal creada y asignada correctamente.');
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      const msg = err?.message || 'Error al crear la sucursal';
      setError(msg);
      toast.error(msg);
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
      jefe_jefe: 'Jefe de jefes',
      jefe_sucursal: 'Jefe de sucursal',
    };
    return roles[role] || role;
  };

  const openBranchPicker = async () => {
    if (!user?.tenant_id) {
      if (formData.branch_id) {
        toast.message('Sin organización vinculada: solo puedes editar los datos de tu sucursal actual.');
        void openEditBranchDialog();
      } else {
        toast.error('Tu cuenta no tiene organización (tenant). Contacta soporte o completa el onboarding.');
      }
      return;
    }
    setBranchPickerLoading(true);
    setError('');
    try {
      const { data, error: listErr } = await supabase
        .from('branches')
        .select('id, name')
        .eq('tenant_id', user.tenant_id)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (listErr) throw listErr;
      const list = (data ?? []) as { id: string; name: string }[];
      setTenantBranchesList(list);
      const initial =
        formData.branch_id && list.some((b) => b.id === formData.branch_id)
          ? formData.branch_id
          : (list[0]?.id ?? '');
      setPickerBranchId(initial);
      setBranchPickerOpen(true);
      if (list.length === 0) {
        toast.message('No hay sucursales en tu organización. Crea una nueva.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar las sucursales';
      setError(msg);
      toast.error(msg);
    } finally {
      setBranchPickerLoading(false);
    }
  };

  const applyPickedBranch = async () => {
    if (!user?.id || !pickerBranchId) {
      toast.error('Selecciona una sucursal.');
      return;
    }
    if (pickerBranchId === formData.branch_id) {
      toast.message('Ya tienes asignada esta sucursal.');
      setBranchPickerOpen(false);
      return;
    }
    setBranchPickerApplying(true);
    setError('');
    try {
      const userUpdatePayload: Database['public']['Tables']['users']['Update'] = {
        branch_id: pickerBranchId,
        updated_at: new Date().toISOString(),
      };
      const { error: updateErr } = await supabase
        .from('users')
        // @ts-expect-error - Supabase generated types infer never for update in this setup
        .update(userUpdatePayload)
        .eq('id', user.id);
      if (updateErr) throw updateErr;
      await supabase.auth.updateUser({
        data: { branch_id: pickerBranchId },
      });
      await fetchUserProfile(user.id);
      setFormData((prev) => ({ ...prev, branch_id: pickerBranchId }));
      const pickedName = tenantBranchesList.find((b) => b.id === pickerBranchId)?.name;
      if (pickedName) setCurrentBranchName(pickedName);
      setBranchPickerOpen(false);
      toast.success('Sucursal asignada a tu perfil.');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar la sucursal';
      setError(msg);
      toast.error(msg);
    } finally {
      setBranchPickerApplying(false);
    }
  };

  const openEditBranchDialog = async (branchId?: string) => {
    const id = branchId ?? formData.branch_id;
    if (!id) return;
    setEditBranchLoading(true);
    setEditingBranchId(id);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, city, region, phone, email, opening_hours')
        .eq('id', id)
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
      setEditingBranchId(null);
      setError(err instanceof Error ? err.message : 'Error al cargar la sucursal');
    } finally {
      setEditBranchLoading(false);
    }
  };

  const handleOpenBranchFieldAction = () => {
    if (canManageOrgBranches) {
      void openBranchPicker();
    } else {
      void openEditBranchDialog();
    }
  };

  const openNewBranchFromPicker = () => {
    setBranchPickerOpen(false);
    setNewBranch({ name: '', address: '', city: '', region: '', opening_hours: '', phone: '', email: '' });
    setCreateBranchDialogOpen(true);
  };

  const openEditBranchFromPicker = () => {
    if (!pickerBranchId) {
      toast.error('Selecciona una sucursal en la lista.');
      return;
    }
    setBranchPickerOpen(false);
    void openEditBranchDialog(pickerBranchId);
  };

  const handleSaveEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingBranchId ?? formData.branch_id;
    if (!targetId) return;
    if (!editBranchForm.name.trim()) {
      setError('El nombre de la sucursal es obligatorio.');
      return;
    }
    setEditBranchSaving(true);
    setError('');
    try {
      const payload: Database['public']['Tables']['branches']['Update'] = {
        name: editBranchForm.name.trim(),
        address: optionalBranchText(editBranchForm.address),
        city: optionalBranchText(editBranchForm.city),
        region: optionalBranchText(editBranchForm.region),
        phone: editBranchForm.phone.trim() || null,
        email: editBranchForm.email.trim() || null,
        opening_hours: editBranchForm.opening_hours.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error: updateErr } = await supabase
        .from('branches')
        // @ts-expect-error - Supabase generated types infer never for update in this setup
        .update(payload)
        .eq('id', targetId);
      if (updateErr) throw updateErr;
      if (targetId === formData.branch_id) {
        setCurrentBranchName(editBranchForm.name.trim());
      }
      setEditBranchDialogOpen(false);
      setEditingBranchId(null);
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
          Gestiona tu perfil, sucursal y la API de ingesta de leads para n8n
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

                {/* Sucursal */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Sucursal
                  </Label>
                  {!formData.branch_id ? (
                    <div className="rounded-lg border border-dashed p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        No tienes sucursal asignada. Agrega una o elige una de tu organización para integraciones como Meta Ads.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setNewBranch({ name: '', address: '', city: '', region: '', opening_hours: '', phone: '', email: '' });
                            setCreateBranchDialogOpen(true);
                          }}
                          disabled={loading}
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          Agregar sucursal
                        </Button>
                        {canManageOrgBranches && user?.tenant_id ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void openBranchPicker()}
                            disabled={loading || branchPickerLoading}
                          >
                            Elegir sucursal existente
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                      <span className="text-sm flex-1">
                        Sucursal actual: <strong>{currentBranchName ?? '…'}</strong>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={handleOpenBranchFieldAction}
                        disabled={editBranchLoading || branchPickerLoading}
                        title={canManageOrgBranches ? 'Elegir, crear o editar sucursal' : 'Editar sucursal'}
                      >
                        {editBranchLoading || branchPickerLoading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Administradores: elegir sucursal del tenant o crear otra */}
                  <Dialog open={branchPickerOpen} onOpenChange={setBranchPickerOpen}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Sucursal de trabajo</DialogTitle>
                        <DialogDescription>
                          Elige la sucursal asociada a tu perfil o crea una nueva para tu organización.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        {tenantBranchesList.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No hay sucursales activas. Crea la primera con el botón de abajo.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="branch_picker_select">Sucursal</Label>
                            <Select
                              value={pickerBranchId || undefined}
                              onValueChange={setPickerBranchId}
                              disabled={branchPickerApplying}
                            >
                              <SelectTrigger id="branch_picker_select">
                                <SelectValue placeholder="Selecciona sucursal" />
                              </SelectTrigger>
                              <SelectContent>
                                {tenantBranchesList.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            disabled={!pickerBranchId || branchPickerApplying}
                            onClick={openEditBranchFromPicker}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar datos de la sucursal
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            disabled={branchPickerApplying}
                            onClick={openNewBranchFromPicker}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva sucursal
                          </Button>
                        </div>
                      </div>
                      <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setBranchPickerOpen(false)}
                          disabled={branchPickerApplying}
                        >
                          Cerrar
                        </Button>
                        <Button
                          type="button"
                          disabled={!pickerBranchId || branchPickerApplying || tenantBranchesList.length === 0}
                          onClick={() => void applyPickedBranch()}
                        >
                          {branchPickerApplying ? (
                            <span className="flex items-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Aplicando…
                            </span>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Usar esta sucursal
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Modal editar sucursal */}
                  <Dialog
                    open={editBranchDialogOpen}
                    onOpenChange={(open) => {
                      setEditBranchDialogOpen(open);
                      if (!open) setEditingBranchId(null);
                    }}
                  >
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Editar sucursal</DialogTitle>
                        <DialogDescription>
                          Solo el nombre es obligatorio. Dirección, ciudad y región puedes completarlas después.
                        </DialogDescription>
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
                          <Label htmlFor="edit_branch_address">Dirección (opcional)</Label>
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
                            <Label htmlFor="edit_branch_city">Ciudad (opcional)</Label>
                            <Input
                              id="edit_branch_city"
                              value={editBranchForm.city}
                              onChange={(e) => setEditBranchForm((b) => ({ ...b, city: e.target.value }))}
                              placeholder="Santiago"
                              disabled={editBranchSaving}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit_branch_region">Región (opcional)</Label>
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
                        <DialogDescription>
                          Solo necesitas un nombre. El resto es opcional y lo puedes editar luego.
                        </DialogDescription>
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
                          <Label htmlFor="branch_address">Dirección (opcional)</Label>
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
                            <Label htmlFor="branch_city">Ciudad (opcional)</Label>
                            <Input
                              id="branch_city"
                              value={newBranch.city}
                              onChange={(e) => setNewBranch((b) => ({ ...b, city: e.target.value }))}
                              placeholder="Santiago"
                              disabled={savingBranch}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="branch_region">Región (opcional)</Label>
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

        <LeadIngestApiKeysSection showLinkToIntegrationsPage />
      </div>
    </div>
  );
}
