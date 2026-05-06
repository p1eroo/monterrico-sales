import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

import imgLogin from "@/assets/imglogin.png";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, updateCurrentUser, setPermissionKeys } = useAppStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      remember: false,
    },
  });

  const username = watch("username");
  const password = watch("password");
  const isFormValid = !!username?.trim() && !!password?.trim();

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username.trim(),
          password: data.password,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        const { accessToken, user } = json;
        localStorage.setItem("accessToken", accessToken);
        if (user) {
          updateCurrentUser({
            id: user.id ?? "",
            username: user.username ?? data.username.trim(),
            name: user.name ?? data.username.trim(),
            role: user.role ?? "Usuario",
            roleId: typeof user.roleId === "string" ? user.roleId : undefined,
            roleName:
              typeof user.roleName === "string" ? user.roleName : undefined,
            phone: typeof user.phone === "string" ? user.phone : undefined,
            avatar: typeof user.avatar === "string" ? user.avatar : undefined,
            createdAt:
              typeof user.joinedAt === "string"
                ? user.joinedAt.slice(0, 10)
                : undefined,
            lastActivity:
              typeof user.lastActivity === "string"
                ? user.lastActivity
                : undefined,
          });
          setPermissionKeys(
            Array.isArray(user.permissions) ? user.permissions : null,
          );
        }
        login();
        navigate("/dashboard");
      } else {
        const msg =
          typeof json.message === "string"
            ? json.message
            : Array.isArray(json.message)
              ? json.message.join(", ")
              : "Credenciales inválidas";
        setError(msg);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full flex-row overflow-hidden bg-background">
      {/* Left: Branding / Visual - estilo glassmorphic/claymorphic */}
      <div
        className={cn(
          "relative hidden flex-col overflow-hidden",
          "bg-gradient-to-b from-[#f8f8f9] via-[#f0f0f2] to-[#e8e8ec]",
          "dark:from-[#0f172a] dark:via-[#1e293b] dark:to-[#0f172a]",
          "lg:flex lg:w-[50%] xl:w-[55%]",
        )}
        style={{
          boxShadow: "inset 0 -40px 60px -20px rgba(19, 148, 76, 0.06)",
        }}
      >
        {/* Toques de verde sobre base gris */}
        <div
          className="absolute inset-0 opacity-40 dark:opacity-20"
          style={{
            background:
              "radial-gradient(ellipse 80% 40% at 70% 10%, rgba(220, 252, 231, 0.4) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-100 dark:opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 100% 60% at 10% 90%, rgba(187, 247, 208, 0.25) 0%, transparent 55%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col">
          {/* Logo - esquina superior izquierda */}
          <div className="shrink-0 px-6 pt-6">
            <img
              src="/logo_tm.png"
              alt="Taxi Monterrico"
              className="h-9 w-auto object-contain object-left xl:h-10"
            />
          </div>

          {/* Contenido centrado */}
          <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-8 py-6">
            {/* Título centrado - "una sola plataforma" en verde */}
            <h1 className="text-center text-2xl font-bold leading-tight tracking-tight xl:text-4xl">
              <span className="text-[#333] dark:text-[#f1f5f9]">
                Todo tu equipo,
              </span>
              <br />
              <span className="text-[#13944C]">una sola plataforma</span>
            </h1>

            {/* Ilustración centrada - scale ajustado */}
            <div className="mt-4 flex w-full max-w-[450px] items-center justify-center overflow-visible xl:max-w-[550px] 2xl:mt-8 2xl:max-w-[700px]">
              <img
                src={imgLogin}
                alt="CRM Dashboard"
                className="max-h-full w-full origin-center scale-110 object-contain xl:scale-120"
              />
            </div>

            {/* Subtítulo centrado - parte inferior */}
            <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-[#64748b] dark:text-[#94a3b8] xl:mt-6 xl:text-base">
              Centraliza contactos, oportunidades y tareas. Accede desde
              cualquier lugar y mantén tu equipo alineado.
            </p>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-12 pb-8 text-center text-xs text-[#94a3b8] dark:text-[#64748b] xl:text-sm">
            © Taxi Monterrico · CRM Qatuna
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex flex-1 flex-col overflow-y-auto bg-background px-6 py-8 sm:px-12 md:px-16 lg:px-12 xl:px-24">
        <div className="my-auto relative mx-auto w-full max-w-sm py-4">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          {/* Mobile logo */}
          <div className="mb-6 flex justify-center lg:hidden">
            <img
              src="/logo_tm.png"
              alt="Taxi Monterrico"
              className="h-10 w-auto object-contain"
            />
          </div>

          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-2xl">
            Bienvenido
          </h2>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
          >
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[11px]"
              >
                USUARIO
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="tu_usuario"
                {...register("username")}
                aria-invalid={!!errors.username}
                className={cn(
                  "h-10 rounded-lg transition-all duration-200 sm:h-11",
                  errors.username && "border-destructive",
                )}
                autoComplete="username"
              />
              {errors.username && (
                <p className="text-sm text-destructive transition-opacity">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[11px]"
              >
                CONTRASEÑA
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  className={cn(
                    "h-10 rounded-lg pr-10 transition-all duration-200 sm:h-11",
                    errors.password && "border-destructive",
                  )}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
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
                    <span className="text-sm text-muted-foreground">
                      Recordarme
                    </span>
                  </label>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={cn(
                "h-10 w-full rounded-lg bg-[#13944C] font-medium transition-all duration-200 sm:h-11",
                "hover:bg-[#0f7a3d] hover:shadow-lg hover:shadow-[#13944C]/25",
                "active:scale-[0.99]",
                "disabled:opacity-50 disabled:hover:scale-100",
              )}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                "Ingresar"
              )}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
