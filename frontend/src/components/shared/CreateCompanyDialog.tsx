import { useState } from 'react';
import { toast } from 'sonner';
import type { CompanyRubro, CompanyTipo } from '@/types';
import { companyRubroLabels, companyTipoLabels } from '@/data/mock';
import { useCompaniesStore } from '@/store/companiesStore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateCompanyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCompanyDialogProps) {
  const addCompany = useCompaniesStore((s) => s.addCompany);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [rubro, setRubro] = useState<CompanyRubro | ''>('');
  const [tipo, setTipo] = useState<CompanyTipo | ''>('');

  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setName('');
      setDomain('');
      setRubro('');
      setTipo('');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    addCompany({
      name: trimmed,
      domain: domain.trim() || undefined,
      rubro: rubro || undefined,
      tipo: tipo || undefined,
    });
    toast.success(`Empresa "${trimmed}" creada correctamente`);
    handleOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva empresa</DialogTitle>
          <DialogDescription>
            Crea una empresa de forma independiente. Podrás vincular contactos después.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Nombre de la empresa *</Label>
            <Input
              id="company-name"
              placeholder="Ej: Minera Los Andes SAC"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-domain">Dominio web</Label>
            <Input
              id="company-domain"
              placeholder="Ej: mineraandes.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rubro</Label>
              <Select value={rubro} onValueChange={(v) => setRubro(v as CompanyRubro | '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(companyRubroLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as CompanyTipo | '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(companyTipoLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#13944C] hover:bg-[#0f7a3d]">
              Crear empresa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
