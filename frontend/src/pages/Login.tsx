import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

import imgLogin from "@/assets/imglogin.webp";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const REMEMBERED_USERNAME_KEY = "loginRememberedUsername";

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

function getRememberedLoginDefaults(): Pick<LoginForm, "username" | "remember"> {
  if (typeof window === "undefined") {
    return { username: "", remember: false };
  }

  const saved = localStorage.getItem(REMEMBERED_USERNAME_KEY);
  if (saved?.trim()) {
    return { username: saved.trim(), remember: true };
  }

  return { username: "", remember: false };
}

const rememberedLoginDefaults = getRememberedLoginDefaults();

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
      username: rememberedLoginDefaults.username,
      password: "",
      remember: rememberedLoginDefaults.remember,
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

        if (data.remember) {
          localStorage.setItem(REMEMBERED_USERNAME_KEY, data.username.trim());
        } else {
          localStorage.removeItem(REMEMBERED_USERNAME_KEY);
        }

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
            allowedAreas: Array.isArray(user.allowedAreas) ? user.allowedAreas : [],
          });
          setPermissionKeys(
            Array.isArray(user.permissions) ? user.permissions : null,
          );
        }
        login();
        navigate("/area-select");
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
    <div
      className={cn(
        "relative flex h-screen w-full overflow-hidden bg-background",
        "bg-gradient-to-b from-[#f8f8f9] via-[#f0f0f2] to-[#e8e8ec]",
        "dark:from-background dark:via-background dark:to-background",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-15"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 40%, rgba(220, 252, 231, 0.45) 0%, transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-100 dark:opacity-10"
        style={{
          background:
            "radial-gradient(ellipse 100% 60% at 80% 90%, rgba(187, 247, 208, 0.25) 0%, transparent 55%)",
        }}
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid h-full w-full grid-cols-1 items-center overflow-y-auto px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,38%)_minmax(0,62%)] lg:overflow-visible lg:px-12 lg:py-12 xl:px-16 2xl:px-24">
        <div className="flex flex-col items-center justify-center lg:items-end lg:pr-5 xl:pr-8">
          <div className="flex w-full max-w-[30rem] flex-col items-center">
            <Card
              variant="elevated"
              className="w-full overflow-hidden rounded-[1.75rem] border border-white/50 bg-white/60 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-lg backdrop-saturate-150 dark:border-border dark:bg-card/80 dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            >
            <div className="px-8 py-9 sm:px-9 sm:py-10">
              <div className="mb-7 flex flex-col items-center gap-2.5 lg:items-start">
                <img
                  src="/logo_tm.png"
                  alt="Taxi Monterrico"
                  className="h-12 w-auto object-contain"
                />

              </div>

              <h2 className="text-center text-xl font-bold tracking-tight text-foreground lg:text-left">
                Bienvenido
              </h2>
              <p className="mt-1 text-center text-sm text-muted-foreground lg:text-left">
                Ingresa tus credenciales para continuar
              </p>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-7 space-y-5"
              >
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-sm font-normal text-muted-foreground"
                  >
                    Usuario
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="tusuario"
                    {...register("username")}
                    aria-invalid={!!errors.username}
                    className={cn(
                      "h-10 rounded-xl shadow-none transition-all duration-200 sm:h-11",
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
                    className="text-sm font-normal text-muted-foreground"
                  >
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...register("password")}
                      aria-invalid={!!errors.password}
                      className={cn(
                        "h-10 rounded-xl pr-10 shadow-none transition-all duration-200 sm:h-11",
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
                    "h-11 w-full rounded-full bg-primary font-medium transition-all duration-200",
                    "hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25",
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

                <div className="pt-1 text-center text-xs text-muted-foreground">
                  <a
                    href="/privacy-policy"
                    className="transition-colors hover:text-foreground"
                  >
                    Política de Privacidad
                  </a>
                  <span className="mx-2">·</span>
                  <a
                    href="/terms-of-service"
                    className="transition-colors hover:text-foreground"
                  >
                    Términos del Servicio
                  </a>
                </div>
              </form>
            </div>
          </Card>
        </div>
        </div>

        <div className="relative hidden min-w-0 flex-col items-center justify-center overflow-visible lg:flex">
          <h1 className="mb-8 max-w-xl text-center text-3xl font-semibold leading-tight tracking-tight text-[#212B36] dark:text-foreground xl:mb-10 xl:text-4xl 2xl:text-4xl">
            Todo tu equipo, Una sola plataforma
          </h1>
          <img
            src={imgLogin}
            alt="CRM Dashboard"
            className="h-auto w-[min(100%,720px)] object-contain lg:w-[min(100%,800px)] xl:w-[min(100%,800px)]"
          />
        </div>
      </div>
    </div>
  );
}