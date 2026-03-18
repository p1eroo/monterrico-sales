import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Car, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'carlos.mendoza@taximonterrico.com',
      password: '',
      remember: false,
    },
  });

  function onSubmit() {
    login();
    navigate('/dashboard');
  }

  return (
    <div className="flex min-h-screen">
      {/* Izquierda: formulario */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#13944C] text-white">
              <Car className="size-6" />
            </div>
            <span className="text-xl font-semibold text-foreground">Taxi Monterrico</span>
          </div>

          <h1 className="mb-1 text-2xl font-bold text-foreground">Bienvenido de vuelta</h1>
          <p className="mb-8 text-muted-foreground">Inicia sesión en tu cuenta</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
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
                  className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
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
                      onCheckedChange={field.onChange}
                    />
                    <span className="text-sm text-muted-foreground">Recordarme</span>
                  </label>
                )}
              />
              <button
                type="button"
                className="text-sm text-[#13944C] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#13944C] hover:bg-[#0f7a3d]"
            >
              Iniciar sesión
            </Button>
          </form>
        </div>
      </div>

      {/* Derecha: panel visual (solo lg+) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center bg-gradient-to-br from-[#0f2e1d] to-[#13944C] px-12 py-16">
        <div className="mx-auto max-w-md">
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white">
            Gestiona tus ventas de manera inteligente
          </h2>
          <p className="mb-12 text-lg text-white/90">
            El CRM de Taxi Monterrico te permite centralizar leads, oportunidades y clientes en un solo lugar.
          </p>
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/90">Contactos activos</p>
              <p className="text-2xl font-bold text-white">+24% este mes</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/90">Oportunidades cerradas</p>
              <p className="text-2xl font-bold text-white">12 conversiones</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/90">Pipeline</p>
              <p className="text-2xl font-bold text-white">Seguimiento en tiempo real</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
