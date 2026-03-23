import { useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { User } from '@/types';
import { useRoles } from '@/hooks/useRoles';

export function buildUserFormSchema(isEdit: boolean) {
  return z
    .object({
      name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
      username: z
        .string()
        .min(2, 'El usuario debe tener al menos 2 caracteres')
        .max(64, 'Máximo 64 caracteres')
        .regex(
          /^[a-zA-Z0-9._-]+$/,
          'Solo letras, números, punto, guion y guion bajo',
        ),
      password: z.string().optional(),
      roleId: z.string().min(1, 'Selecciona un rol'),
      status: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (!isEdit) {
        const p = data.password ?? '';
        if (p.length < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Contraseña obligatoria (mínimo 6 caracteres, igual que el registro)',
            path: ['password'],
          });
        }
      }
    });
}

export type UserFormData = z.infer<ReturnType<typeof buildUserFormSchema>>;

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSubmit: (data: UserFormData) => void | Promise<void>;
}

export function UserFormModal({
  open,
  onOpenChange,
  user,
  onSubmit,
}: UserFormModalProps) {
  const isEdit = !!user;
  const { roles, asesorRoleId } = useRoles();
  const schema = useMemo(() => buildUserFormSchema(isEdit), [isEdit]);
  const defaultRoleId = asesorRoleId ?? roles[0]?.id ?? '';

  useEffect(() => {
    if (defaultRoleId && !form.getValues('roleId')) {
      form.setValue('roleId', defaultRoleId);
    }
  }, [defaultRoleId, form]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      username: '',
      password: '',
      roleId: defaultRoleId,
      status: true,
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
    } else if (user) {
      form.reset({
        name: user.name,
        username: user.username ?? user.email?.split('@')[0] ?? '',
        roleId: user.roleId ?? defaultRoleId,
        status: user.status === 'activo',
        password: '',
      });
    } else {
      form.reset({
        name: '',
        username: '',
        password: '',
        roleId: defaultRoleId,
        status: true,
      });
    }
    onOpenChange(next);
  }

  async function handleSubmit(data: UserFormData) {
    try {
      await Promise.resolve(onSubmit(data));
      handleOpenChange(false);
    } catch {
      /* el padre muestra toast; el diálogo permanece abierto */
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos del usuario.'
              : 'El superior define usuario y contraseña inicial. El colaborador podrá cambiar su contraseña desde su perfil.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo *</Label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Usuario *</Label>
            <Input
              id="username"
              autoComplete="username"
              placeholder="Ej: jperez"
              {...form.register('username')}
              disabled={isEdit}
            />
            {form.formState.errors.username && (
              <p className="text-xs text-destructive">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña inicial *</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Rol *</Label>
            <Select
              value={form.watch('roleId')}
              onValueChange={(v) => form.setValue('roleId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.roleId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.roleId.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="status">Estado</Label>
              <p className="text-xs text-muted-foreground">
                Usuarios inactivos no pueden iniciar sesión
              </p>
            </div>
            <Switch
              id="status"
              checked={form.watch('status')}
              onCheckedChange={(v) => form.setValue('status', v)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
