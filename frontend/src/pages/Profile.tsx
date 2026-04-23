import { useState, useRef, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const defaultTab = tabFromUrl && PROFILE_TABS.includes(tabFromUrl as (typeof PROFILE_TABS)[number])
    ? tabFromUrl
    : 'profile';
  const {
    currentUser,
    updateCurrentUser,
    setPermissionKeys,
    preferences,
    updatePreferences,
    gmailConnected,
    setGmailConnected,
  } = useAppStore();
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tu información personal y preferencias de cuenta
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left: Profile card */}
        <Card className="h-fit shrink-0">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="relative group"
              >
                <Avatar className="size-24 border-4 border-[#13944C]/20">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt="" className="size-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-[#13944C]/10 text-[#13944C] text-2xl">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-8 text-white" />
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
                <p className="font-semibold">{currentUser.name}</p>
                <Badge
                  variant="outline"
                  className="mt-2 border-[#13944C] text-[#13944C]"
                >
                  {currentUser.roleName || currentUser.role}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {(currentUser as { status?: string }).status === 'activo'
                    ? 'Cuenta activa'
                    : 'Cuenta inactiva'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Tabs */}
        <Card>
          <Tabs defaultValue={defaultTab} className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="h-auto w-full flex-wrap justify-start">
                <TabsTrigger value="profile" className="gap-2">
                  <User className="size-4" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-2">
                  <Shield className="size-4" />
                  Seguridad
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-2">
                  <Settings className="size-4" />
                  Preferencias
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2">
                  <Activity className="size-4" />
                  Actividad
                </TabsTrigger>
                <TabsTrigger value="integraciones" className="gap-2">
                  <Link2 className="size-4" />
                  Integraciones
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="profile" className="mt-0">
                <div className="space-y-6">
                  {/* Metas semanal y mensual */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <WeeklyGoalCard />
                    <MonthlyGoalCard />
                  </div>

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
              </TabsContent>

              <TabsContent value="security" className="mt-0">
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
              </TabsContent>

              <TabsContent value="preferences" className="mt-0">
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
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
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
              </TabsContent>

              <TabsContent value="integraciones" className="mt-0">
                <div className="space-y-6">
                  <div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <WhatsappIntegrationCard />

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
                                <p className="font-medium">Gmail</p>
                                <Badge
                                  variant="outline"
                                  className={
                                    gmailConnected
                                      ? 'border-[#13944C]/30 bg-[#13944C]/10 text-[#13944C]'
                                      : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  }
                                >
                                  {gmailConnected ? 'Conectado' : 'Demo'}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Ver y enviar correos
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {gmailConnected ? (
                              <Button
                                variant="outline"
                                onClick={() => setGmailConnected(false)}
                              >
                                <CheckCircle2 className="size-4 text-[#13944C]" />
                                Desconectar
                              </Button>
                            ) : (
                              <Button
                                className="bg-[#13944C] hover:bg-[#0f7a3d]"
                                onClick={() => setGmailConnected(true)}
                              >
                                <Link2 className="size-4" />
                                Conectar Gmail
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-1 flex-col gap-4 rounded-xl border bg-muted/20 p-4">
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                            Gmail sigue en modo demostración. La conexión real de esta integración se implementará más adelante.
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-background/40 p-3">
                              <p className="text-xs text-muted-foreground">Estado</p>
                              <p className="mt-1 text-sm font-medium">
                                {gmailConnected ? 'Conectado' : 'Pendiente de conexión'}
                              </p>
                            </div>
                            <div className="rounded-lg bg-background/40 p-3">
                              <p className="text-xs text-muted-foreground">Disponibilidad</p>
                              <p className="mt-1 text-sm font-medium">Módulo de correo CRM</p>
                            </div>
                          </div>

                          <div className="rounded-lg bg-background/40 p-4">
                            <p className="text-sm font-medium">Qué incluye</p>
                            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                              <li>Ver correos relacionados desde el CRM.</li>
                              <li>Enviar mensajes usando tu cuenta conectada.</li>
                              <li>Sincronización segura tras autorización de Google.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
          </CardContent>
            </Tabs>
        </Card>
      </div>
    </div>
  );
}
