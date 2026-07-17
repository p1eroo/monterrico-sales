import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Shield,
  Settings,
  Activity,
  Camera,
  Eye,
  EyeOff,
  Bell,
  CheckCircle2,
  Loader2,
  Link2,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { userActivityStats, userActivityTimeline } from '@/data/profileMock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { AvatarImage } from '@/lib/avatar';
import { formatDateTime } from '@/lib/formatters';
import {
  api,
  patchAuthProfile,
  uploadAuthAvatar,
} from '@/lib/api';
import { fetchCrmConfig } from '@/lib/crmConfigApi';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import { hydrateGoalsFromBundle } from '@/store/goalsStore';
import { WeeklyGoalCard } from '@/components/shared/WeeklyGoalCard';
import { MonthlyGoalCard } from '@/components/shared/MonthlyGoalCard';
import { WhatsappIntegrationCard } from '@/components/profile/WhatsappIntegrationCard';

const profileSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Requerido'),
    newPassword: z.string().min(6, 'Mínimo 6 caracteres (igual que al registrarte)'),
    confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

function getPasswordStrength(pwd: string): { label: string; value: number; color: string } {
  if (!pwd) return { label: '', value: 0, color: '' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score <= 2) return { label: 'Débil', value: 33, color: 'bg-red-500' };
  if (score <= 4) return { label: 'Media', value: 66, color: 'bg-amber-500' };
  return { label: 'Fuerte', value: 100, color: 'bg-[#13944C]' };
}

const ACTION_LABELS: Record<string, string> = {
  crear: 'Creó',
  actualizar: 'Actualizó',
  eliminar: 'Eliminó',
  asignar: 'Asignó',
  cambiar_etapa: 'Cambió etapa',
};

const PROFILE_TABS = ['profile', 'security', 'preferences', 'activity', 'integraciones'] as const;

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const urlTab =
    tabFromUrl && PROFILE_TABS.includes(tabFromUrl as (typeof PROFILE_TABS)[number])
      ? tabFromUrl
      : 'profile';

  const [activeTab, setActiveTab] = useState<string>(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const handleProfileTabChange = useCallback(
    (value: string) => {
      if (!PROFILE_TABS.includes(value as (typeof PROFILE_TABS)[number])) return;
      setActiveTab(value);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === 'profile') {
            next.delete('tab');
          } else {
            next.set('tab', value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const {
    currentUser,
    updateCurrentUser,
    setPermissionKeys,
    preferences,
    updatePreferences,
    googleConnected,
    setGoogleConnected,
    area,
  } = useAppStore();
  const allowedAreas = currentUser.allowedAreas || [];
  const isFlota = area === 'flota' || (allowedAreas.length === 1 && allowedAreas[0] === 'flota');
  const setCrmBundle = useCrmConfigStore((s) => s.setBundle);

  useEffect(() => {
    if (!currentUser.id) return;
    let cancelled = false;
    void fetchCrmConfig()
      .then((b) => {
        if (cancelled) return;
        setCrmBundle(b);
        hydrateGoalsFromBundle(b, currentUser.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser.id, setCrmBundle]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentUser.name,
      phone: currentUser.phone ?? '',
    },
  });

  useEffect(() => {
    profileForm.reset({
      name: currentUser.name,
      phone: currentUser.phone ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo sincronizar con datos de sesión
  }, [currentUser.id, currentUser.name, currentUser.phone]);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = passwordForm.watch('newPassword');
  const passwordStrength = getPasswordStrength(newPassword);

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  const handleProfileSubmit = profileForm.handleSubmit(async (data) => {
    setIsSavingProfile(true);
    try {
      const me = await patchAuthProfile({
        name: data.name.trim(),
        phone: data.phone?.trim() ?? '',
      });
      updateCurrentUser({
        name: me.name,
        phone: me.phone || undefined,
        avatar: me.avatar || undefined,
        role: me.role,
        roleId: me.roleId,
        roleName: me.roleName,
        createdAt: me.joinedAt?.slice(0, 10),
        lastActivity: me.lastActivity ?? undefined,
      });
      setPermissionKeys(me.permissions);
      toast.success('Perfil actualizado correctamente');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo guardar el perfil',
      );
    } finally {
      setIsSavingProfile(false);
    }
  });

  const handlePasswordSubmit = passwordForm.handleSubmit(async (formData) => {
    setIsSavingPassword(true);
    try {
      await api<{ ok: boolean; message?: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });
      passwordForm.reset();
      setPasswordSaved(true);
      toast.success('Contraseña actualizada');
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo cambiar la contraseña',
      );
    } finally {
      setIsSavingPassword(false);
    }
  });

  const handleAvatarClick = () => avatarInputRef.current?.click();
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      if (file) toast.error('Selecciona una imagen (JPEG, PNG, WebP o GIF)');
      return;
    }
    void (async () => {
      try {
        const me = await uploadAuthAvatar(file);
        if (currentUser.avatar?.startsWith('blob:')) {
          URL.revokeObjectURL(currentUser.avatar);
        }
        updateCurrentUser({
          avatar: me.avatar || undefined,
          name: me.name,
          phone: me.phone || undefined,
          roleName: me.roleName,
        });
        setPermissionKeys(me.permissions);
        toast.success('Foto actualizada');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo subir la foto',
        );
      } finally {
        e.target.value = '';
      }
    })();
  };

  const NAV_SECTIONS = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'preferences', label: 'Preferencias', icon: Settings },
    { id: 'activity', label: 'Actividad', icon: Activity },
    { id: 'integraciones', label: 'Integraciones', icon: Link2 },
  ];

  const visibleSections = NAV_SECTIONS.filter(
    (s) => (isFlota ? s.id !== 'activity' && s.id !== 'integraciones' : true),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tu información personal y preferencias de cuenta
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* LEFT: Avatar card + nav */}
        <div className="space-y-4 lg:w-56 lg:shrink-0">
          <Card className="h-fit shrink-0">
            <CardContent className="pt-4">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="relative group"
                >
                  <Avatar className="size-20 border-4 border-[#13944C]/20">
                    <AvatarImage name={currentUser.name} avatar={currentUser.avatar} size={80} />
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="size-6 text-white" />
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-sm">{currentUser.name}</p>
                  <Badge
                    variant="outline"
                    className="mt-1.5 border-[#13944C] text-[#13944C] text-[10px]"
                  >
                    {currentUser.roleName || currentUser.role}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile tab selector */}
          <div className="lg:hidden">
            <label htmlFor="profile-main-tab" className="text-xs font-medium text-muted-foreground">
              Sección
            </label>
            <select
              id="profile-main-tab"
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={activeTab}
              onChange={(e) => handleProfileTabChange(e.target.value)}
            >
              {visibleSections.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop vertical nav */}
          <nav className="hidden gap-1 lg:flex lg:flex-col lg:gap-0.5">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleProfileTabChange(section.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap transition-colors text-left',
                    activeTab === section.id
                      ? 'bg-[#13944C]/10 text-[#13944C] font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* RIGHT: Content area */}
        <div className="min-w-0 flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {!isFlota && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <WeeklyGoalCard />
                  <MonthlyGoalCard />
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div>
                  <CardTitle className="text-base mb-4">Información personal</CardTitle>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Nombre completo</Label>
                      <Input
                        {...profileForm.register('name')}
                        className="mt-1"
                        placeholder="Tu nombre"
                      />
                      {profileForm.formState.errors.name && (
                        <p className="mt-1 text-sm text-destructive">
                          {profileForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input
                        {...profileForm.register('phone')}
                        className="mt-1"
                        placeholder="+51 999 000 000"
                      />
                    </div>
                    <div>
                      <Label>Cargo</Label>
                      <Input
                        className="mt-1"
                        disabled
                        value={currentUser.roleName || currentUser.role}
                        readOnly
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Corresponde al nombre del rol asignado (solo lectura)
                      </p>
                    </div>
                    <div>
                      <Label>Organización</Label>
                      <Input
                        className="mt-1"
                        disabled
                        value="Taxi Monterrico"
                        readOnly
                      />
                    </div>
                    <div>
                      <Label>Rol (identificador)</Label>
                      <Input
                        className="mt-1"
                        disabled
                        value={currentUser.role}
                        readOnly
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Lo asigna un administrador; define permisos en el sistema
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Información de cuenta</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Miembro desde{' '}
                    {(currentUser as { createdAt?: string }).createdAt
                      ? new Date(
                          (currentUser as { createdAt?: string }).createdAt + 'T12:00:00'
                        ).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Última actividad:{' '}
                    {(() => {
                      const la = (currentUser as { lastActivity?: string }).lastActivity;
                      return la ? formatDateTime(la) : '-';
                    })()}
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-[#13944C] hover:bg-[#0f7a3d]"
                >
                  {isSavingProfile ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Guardar cambios
                </Button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <CardTitle className="text-base mb-4">Cambiar contraseña</CardTitle>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Usa la misma cuenta con la que iniciaste sesión en el servidor (JWT). Mínimo 6 caracteres en la nueva clave.
                </p>
                <div className="space-y-4 max-w-md">
                  <div>
                    <Label>Contraseña actual</Label>
                    <div className="relative">
                      <Input
                        {...passwordForm.register('currentPassword')}
                        type={showPassword ? 'text' : 'password'}
                        className="mt-1 pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="mt-1 text-sm text-destructive">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Nueva contraseña</Label>
                    <div className="relative">
                      <Input
                        {...passwordForm.register('newPassword')}
                        type={showPassword ? 'text' : 'password'}
                        className="mt-1 pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="mt-2">
                        <div className="flex gap-2 items-center">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                passwordStrength.color
                              )}
                              style={{ width: `${passwordStrength.value}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {passwordStrength.label}
                          </span>
                        </div>
                      </div>
                    )}
                    {passwordForm.formState.errors.newPassword && (
                      <p className="mt-1 text-sm text-destructive">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Confirmar contraseña</Label>
                    <div className="relative">
                      <Input
                        {...passwordForm.register('confirmPassword')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="mt-1 pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="mt-1 text-sm text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                disabled={isSavingPassword}
                className="bg-[#13944C] hover:bg-[#0f7a3d]"
              >
                {isSavingPassword ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : passwordSaved ? (
                  <CheckCircle2 className="size-4 text-green-500" />
                ) : (
                  <Shield className="size-4" />
                )}
                {passwordSaved ? 'Contraseña actualizada' : 'Actualizar contraseña'}
              </Button>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="w-full rounded-xl border border-border bg-card p-5 shadow-none dark:shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
                    <Bell className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Notificaciones</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Decide qué alertas quieres recibir dentro del CRM y por correo.
                    </p>
                  </div>
                </div>
                <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
                  {[
                    {
                      key: 'emailNotifications' as const,
                      label: 'Recibir emails',
                      desc: 'Notificaciones por correo electrónico',
                    },
                    {
                      key: 'systemNotifications' as const,
                      label: 'Notificaciones del sistema',
                      desc: 'Alertas en la aplicación',
                    },
                    {
                      key: 'reminders' as const,
                      label: 'Recordatorios',
                      desc: 'Recordatorios de tareas',
                    },
                    {
                      key: 'activityAlerts' as const,
                      label: 'Alertas de actividades',
                      desc: 'Nuevas actividades asignadas',
                    },
                  ].map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="pr-4">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        checked={preferences[key]}
                        onCheckedChange={(v) => updatePreferences({ [key]: v })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && !isFlota && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-base mb-4">Resumen de actividad</CardTitle>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">
                        Contactos creados
                      </p>
                      <p className="text-2xl font-bold text-[#13944C]">
                        {userActivityStats.contactsCreated}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">
                        Oportunidades gestionadas
                      </p>
                      <p className="text-2xl font-bold">
                        {userActivityStats.opportunitiesManaged}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">
                        Actividades realizadas
                      </p>
                      <p className="text-2xl font-bold">
                        {userActivityStats.activitiesCompleted}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">
                        Campañas enviadas
                      </p>
                      <p className="text-2xl font-bold">
                        {userActivityStats.campaignsSent}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
              <div>
                <CardTitle className="text-base mb-4">Actividad reciente</CardTitle>
                <div className="space-y-2">
                  {userActivityTimeline.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-lg border p-4"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#13944C]/10">
                        <Activity className="size-5 text-[#13944C]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {ACTION_LABELS[item.action] ?? item.action}{' '}
                          {item.entityName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(item.timestamp)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.status === 'exito' ? 'default' : 'secondary'
                        }
                        className={
                          item.status === 'exito'
                            ? 'bg-[#13944C] shrink-0'
                            : 'shrink-0'
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integraciones' && (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <WhatsappIntegrationCard />

                {!isFlota && (
                  <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-none dark:shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex size-12 items-center justify-center rounded-lg bg-[#ea4335]/10">
                          <svg className="size-7" viewBox="0 0 24 24">
                            <path
                              fill="#EA4335"
                              d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.883l8.073-6.39C21.69 2.28 24 3.434 24 5.457z"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">Google</p>
                            <Badge
                              variant="outline"
                              className={
                                googleConnected
                                  ? 'border-[#13944C]/30 bg-[#13944C]/10 text-[#13944C]'
                                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              }
                            >
                              {googleConnected ? 'Conectado' : 'Demo'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Gmail y Google Calendar
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {googleConnected ? (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                await api('/auth/google/disconnect', { method: 'POST' });
                                setGoogleConnected(false);
                                toast.success('Google desconectado');
                              } catch {
                                toast.error('Error al desconectar Google');
                              }
                            }}
                          >
                            <CheckCircle2 className="size-4 text-[#13944C]" />
                            Desconectar
                          </Button>
                        ) : (
                          <Button
                            className="bg-[#13944C] hover:bg-[#0f7a3d]"
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('accessToken');
                                if (!token) { toast.error('No hay sesión activa'); return; }
                                const res = await api<{ state: string }>('/auth/google/init', {
                                  method: 'POST',
                                  body: JSON.stringify({ token }),
                                });
                                window.location.href = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/auth/google?state=${res.state}`;
                              } catch {
                                toast.error('Error al iniciar conexión con Google');
                              }
                            }}
                          >
                            <Link2 className="size-4" />
                            Conectar Google
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-1 flex-col gap-4 rounded-xl border bg-muted/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-background/40 p-3">
                          <p className="text-xs text-muted-foreground">Estado</p>
                          <p className="mt-1 text-sm font-medium">
                            {googleConnected ? 'Conectado' : 'Pendiente de conexión'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-background/40 p-3">
                          <p className="text-xs text-muted-foreground">Disponibilidad</p>
                          <p className="mt-1 text-sm font-medium">Gmail + Google Calendar</p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-background/40 p-4">
                        <p className="text-sm font-medium">Qué incluye</p>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          <li>Ver y enviar correos desde el CRM.</li>
                          <li>Sincronizar eventos de Google Calendar.</li>
                          <li>Crear y gestionar tareas desde Google Tasks.</li>
                          <li>Sincronización segura tras autorización de Google.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
