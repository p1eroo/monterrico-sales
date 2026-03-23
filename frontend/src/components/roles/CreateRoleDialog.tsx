import { useState } from 'react';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RBACRole, PermissionKey } from '@/types';
import {
  ROLE_TEMPLATES,
  getTemplatePermissions,
} from '@/data/rbac';
import { PermissionMatrix } from './PermissionMatrix';
import { cn } from '@/lib/utils';

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (role: Omit<RBACRole, 'userCount'>) => void | Promise<void>;
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  onSave,
}: CreateRoleDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [templateId, setTemplateId] = useState<string>('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(
    () => getTemplatePermissions('personalizado')
  );

  function handleTemplateSelect(id: string) {
    setTemplateId(id);
    if (id !== 'personalizado') {
      setPermissions(getTemplatePermissions(id));
      const t = ROLE_TEMPLATES.find((x) => x.id === id);
      if (t) {
        setRoleName(t.name);
        setRoleDescription(t.description);
      }
    } else {
      setPermissions(getTemplatePermissions('personalizado'));
      setRoleName('');
      setRoleDescription('');
    }
  }

  function goToStep2() {
    if (templateId) {
      setStep(2);
    }
  }

  function goBack() {
    setStep(1);
  }

  async function handleSave() {
    const trimmedName = roleName.trim();
    if (!trimmedName) return;

    const newRole: Omit<RBACRole, 'userCount'> = {
      id: `r${Date.now()}`,
      name: trimmedName,
      description: roleDescription.trim() || 'Rol personalizado',
      templateId: templateId === 'personalizado' ? undefined : templateId,
      permissions: { ...permissions },
    };
    try {
      await onSave(newRole);
      handleClose();
    } catch {
      // Error ya manejado por el caller (toast)
    }
  }

  function handleClose() {
    setStep(1);
    setTemplateId('');
    setRoleName('');
    setRoleDescription('');
    setPermissions(getTemplatePermissions('personalizado'));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-[90vw] sm:!max-w-[90vw] lg:!max-w-6xl w-[90vw] sm:w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Crear rol' : 'Personalizar permisos'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Selecciona una plantilla base para empezar. Podrás ajustar los permisos en el siguiente paso.'
              : 'Revisa y ajusta los permisos del rol. Los cambios se aplicarán al crear.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplateSelect(t.id)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all hover:border-[#13944C]/50 hover:bg-[#13944C]/5',
                    templateId === t.id &&
                      'border-[#13944C] bg-[#13944C]/10 ring-1 ring-[#13944C]/30'
                  )}
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre del rol</Label>
                <Input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Ej: Coordinador de ventas"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Breve descripción del rol"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Permisos por módulo</Label>
              <PermissionMatrix
                permissions={permissions}
                onChange={(key, value) =>
                  setPermissions((p) => ({ ...p, [key]: value }))
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={goToStep2}
                disabled={!templateId}
                className="bg-[#13944C] hover:bg-[#0f7a3d]"
              >
                Siguiente
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="size-4" />
                Atrás
              </Button>
              <Button
                onClick={handleSave}
                disabled={!roleName.trim()}
                className="bg-[#13944C] hover:bg-[#0f7a3d]"
              >
                Crear rol
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
