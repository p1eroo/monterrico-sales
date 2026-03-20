import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Info } from 'lucide-react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

import imgLogin from '@/assets/imglogin.png';

const loginSchema = z.object({
  email: z.string().min(1, 'Usuario o email requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

  const email = watch('email');
  const password = watch('password');
  const isFormValid = !!email?.trim() && !!password?.trim();

  async function onSubmit() {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    login();
    navigate('/dashboard');
    setIsLoading(false);
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: Branding / Visual - estilo glassmorphic/claymorphic */}
      <div
        className={cn(
          'relative hidden flex-col overflow-visible',
          'bg-gradient-to-b from-[#f8f8f9] via-[#f0f0f2] to-[#e8e8ec]',
          'dark:from-[#0f172a] dark:via-[#1e293b] dark:to-[#0f172a]',
          'lg:flex lg:w-[26%]'
        )}
        style={{
          boxShadow: 'inset 0 -40px 60px -20px rgba(19, 148, 76, 0.06)',
        }}
      >
        {/* Toques de verde sobre base gris */}
        <div
          className="absolute inset-0 opacity-40 dark:opacity-20"
          style={{
            background:
              'radial-gradient(ellipse 80% 40% at 70% 10%, rgba(220, 252, 231, 0.4) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-100 dark:opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 100% 60% at 10% 90%, rgba(187, 247, 208, 0.25) 0%, transparent 55%)',
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col">
          {/* Logo - esquina superior izquierda */}
          <div className="shrink-0 px-4 pt-4 xl:px-5 xl:pt-5">
            <img
              src="/logo_tm.png"
              alt="Taxi Monterrico"
              className="h-9 w-auto object-contain object-left xl:h-10"
            />
          </div>

          {/* Contenido centrado */}
          <div className="flex flex-1 flex-col items-center justify-center overflow-visible px-4 py-12 xl:px-6 xl:py-16">
            {/* Título centrado - "una sola plataforma" en verde */}
            <h1 className="text-center text-2xl font-bold leading-tight tracking-tight xl:text-3xl">
              <span className="text-[#333] dark:text-[#f1f5f9]">Todo tu equipo,</span>
              <br />
              <span className="text-[#13944C]">una sola plataforma</span>
            </h1>

            {/* Ilustración centrada - scale para que se vea más grande en columna estrecha */}
            <div className="mt-12 w-full overflow-visible xl:mt-16">
              <img
                src={imgLogin}
                alt="CRM Dashboard"
                className="w-full origin-center scale-110 object-contain xl:scale-[1.2]"
              />
            </div>

            {/* Subtítulo centrado - parte inferior */}
            <p className="mt-12 max-w-md text-center text-sm leading-relaxed text-[#64748b] dark:text-[#94a3b8] xl:mt-16 xl:text-base">
              Centraliza contactos, oportunidades y seguimientos. Accede desde
              cualquier lugar y mantén tu equipo alineado.
            </p>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-12 pb-8 text-center text-sm text-[#94a3b8] dark:text-[#64748b] xl:px-16 xl:pb-10">
            © Taxi Monterrico · CRM Qatuna
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex w-full flex-1 flex-col justify-center bg-background px-6 py-12 lg:px-16 xl:px-24">
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <img
              src="/logo_tm.png"
              alt="Taxi Monterrico"
              className="h-9 w-auto object-contain"
            />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-muted-foreground">
            Accede a tu CRM de Taxi Monterrico
          </p>

          {/* Info banner */}
          <div
            className="mt-6 flex items-start gap-3 rounded-xl border border-[#13944C]/20 bg-[#13944C]/5 px-4 py-3"
            role="alert"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-[#13944C]" />
            <p className="text-sm text-foreground/90">
              Usa tu cuenta del sistema
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Usuario o Email</Label>
                <Input
                id="email"
                type="text"
                placeholder="usuario@taximonterrico.com"
                {...register('email')}
                aria-invalid={!!errors.email}
                className={cn(
                  'h-11 rounded-lg transition-all duration-200',
                  errors.email && 'border-destructive focus-visible:ring-destructive'
                )}
                autoComplete="username"
              />
              {errors.email && (
                <p className="text-sm text-destructive transition-opacity">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  className={cn(
                    'h-11 rounded-lg pr-10 transition-all duration-200',
                    errors.password && 'border-destructive focus-visible:ring-destructive'
                  )}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Controller
                name="remember"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={(v) => field.onChange(!!v)}
                      className="rounded-md"
                    />
                    <span className="text-sm text-muted-foreground">Recordarme</span>
                  </label>
                )}
              />
              <button
                type="button"
                className="text-sm font-medium text-[#13944C] transition-colors hover:text-[#0f7a3d] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={cn(
                'h-11 w-full rounded-lg bg-[#13944C] font-medium transition-all duration-200',
                'hover:bg-[#0f7a3d] hover:shadow-lg hover:shadow-[#13944C]/25',
                'active:scale-[0.99]',
                'disabled:opacity-50 disabled:hover:scale-100'
              )}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
