import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const registerSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  name: z.string().min(1, 'Nombre requerido'),
  role: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login, updateCurrentUser, setPermissionKeys } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      name: '',
      role: 'asesor',
    },
  });

  async function onSubmit(data: RegisterForm) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username.trim(),
          password: data.password,
          name: data.name.trim(),
          ...(data.role?.trim() ? { role: data.role.trim() } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const { accessToken, user } = json;
        if (accessToken) {
          localStorage.setItem('accessToken', accessToken);
        }
        if (user) {
          updateCurrentUser({
            id: user.id ?? '',
            username: user.username ?? data.username.trim(),
            name: user.name ?? data.name.trim(),
            role: user.role ?? 'asesor',
            roleId: typeof user.roleId === 'string' ? user.roleId : undefined,
            roleName: typeof user.roleName === 'string' ? user.roleName : undefined,
            phone: typeof user.phone === 'string' ? user.phone : undefined,
            avatar: typeof user.avatar === 'string' ? user.avatar : undefined,
            createdAt:
              typeof user.joinedAt === 'string'
                ? user.joinedAt.slice(0, 10)
                : undefined,
            lastActivity:
              typeof user.lastActivity === 'string' ? user.lastActivity : undefined,
          });
          setPermissionKeys(
            Array.isArray(user.permissions) ? user.permissions : null,
          );
        }
        login();
        navigate('/dashboard');
      } else {
        const msg =
          typeof json.message === 'string'
            ? json.message
            : Array.isArray(json.message)
              ? json.message.join(', ')
              : 'No se pudo registrar';
        setError(msg);
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solo si el servidor permite registro (primer usuario o{' '}
            <code className="rounded bg-muted px-1 text-xs">
              ALLOW_OPEN_REGISTRATION
            </code>
            ).
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-name">Nombre completo</Label>
            <Input
              id="reg-name"
              {...register('name')}
              aria-invalid={!!errors.name}
              className={cn(errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-username">Usuario</Label>
            <Input
              id="reg-username"
              autoComplete="username"
              {...register('username')}
              aria-invalid={!!errors.username}
              className={cn(errors.username && 'border-destructive')}
            />
            {errors.username && (
              <p className="text-sm text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Contraseña</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              aria-invalid={!!errors.password}
              className={cn(errors.password && 'border-destructive')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-role">Rol (opcional)</Label>
            <Input
              id="reg-role"
              placeholder="admin, supervisor, asesor, solo_lectura…"
              {...register('role')}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#13944C] hover:bg-[#0f7a3d]"
          >
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              'Registrarse'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-[#13944C] hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
