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
import { INITIAL_ROLES } from '@/data/rbac';

const userFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().optional(),
  roleId: z.string().min(1, 'Selecciona un rol'),
  status: z.boolean(),
  phone: z.string().optional(),
});

export type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSubmit: (data: UserFormData) => void;
}

export function UserFormModal({
  open,
  onOpenChange,
  user,
  onSubmit,
}: UserFormModalProps) {
  const isEdit = !!user;

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      roleId: 'r3',
      status: true,
      phone: '',
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset();
    } else if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        roleId: user.roleId ?? 'r3',
        status: user.status === 'activo',
        phone: user.phone ?? '',
      });
    }
    onOpenChange(next);
  }

  function handleSubmit(data: UserFormData) {
    onSubmit(data);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos del usuario.'
              : 'Añade un nuevo usuario al equipo. La contraseña se enviará por email (mock).'}
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
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@taximonterrico.com"
              {...form.register('email')}
              disabled={isEdit}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña (opcional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Se generará automáticamente si se deja vacío"
                {...form.register('password')}
              />
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
                {INITIAL_ROLES.map((r) => (
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
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              placeholder="+51 999 000 000"
              {...form.register('phone')}
            />
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
            <Button type="submit" className="bg-[#13944C] hover:bg-[#0f7a3d]">
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
