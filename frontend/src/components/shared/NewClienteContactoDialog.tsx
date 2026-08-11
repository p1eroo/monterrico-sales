import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, Link2, Search } from 'lucide-react';
import { toast } from '@/lib/notify';
import { useAppStore } from '@/store';
import { resolveAdvisorAssigneeId, canUserReassignCommercialAdvisor } from '@/lib/advisorAssigneeDefaults';
import { fetchClienteEmpresas } from '@/lib/clienteCarteraApi';
import type { NewContactData } from '@/components/shared/NewContactWizard';
import { AssignedAdvisorFormField } from '@/components/shared/AssignedAdvisorFormField';
import { TaskAssociationPickerLoadMore } from '@/components/shared/TaskAssociationPickerLoadMore';
import { useTaskAssociationPickerPagination } from '@/hooks/useTaskAssociationPickerPagination';
import { paginateAssociationPickerItems } from '@/lib/taskAssociationPicker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  FormDialogActions,
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
  formDialogPickerTriggerClass,
  formDialogPopoverContentClass,
  formDialogScrollListClass,
} from '@/components/ui/form-dialog';

type ClienteEmpresaOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewContactData) => void | Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
};

export function NewClienteContactoDialog({
  open,
  onOpenChange,
  onSubmit,
  title = 'Nuevo contacto',
  description = 'Registra un nuevo contacto de cartera.',
  submitLabel = 'Crear contacto',
}: Props) {
  const currentUser = useAppStore((s) => s.currentUser);
  const canReassign = canUserReassignCommercialAdvisor(currentUser.role);

  const [name, setName] = useState('');
  const [cargo, setCargo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedTo, setAssignedTo] = useState(() =>
    resolveAdvisorAssigneeId(undefined, currentUser),
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<ClienteEmpresaOption[]>([]);
  const [assocPanelOpen, setAssocPanelOpen] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setCargo('');
    setEmail('');
    setPhone('');
    setAssignedTo(resolveAdvisorAssigneeId(undefined, currentUser));
    setSelectedCompanyId(null);
    setAssocPanelOpen(false);
    setAssocSearch('');
    setSubmitting(false);
  }, [currentUser]);

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchClienteEmpresas()
      .then((list) => {
        if (cancelled) return;
        setEmpresas(list.map((row) => ({ id: row.id, name: row.empresa })));
      })
      .catch(() => {
        if (cancelled) return;
        setEmpresas([]);
        toast.error('No se pudieron cargar las empresas cliente.');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedCompany = useMemo(
    () => empresas.find((empresa) => empresa.id === selectedCompanyId) ?? null,
    [empresas, selectedCompanyId],
  );

  const filteredEmpresasAll = useMemo(() => {
    const query = assocSearch.trim().toLowerCase();
    if (!query) return empresas;
    return empresas.filter((empresa) => empresa.name.toLowerCase().includes(query));
  }, [empresas, assocSearch]);

  const { visibleCount: assocVisibleCount, showMore: showMoreAssocItems } =
    useTaskAssociationPickerPagination(assocSearch);

  const filteredEmpresas = useMemo(
    () => paginateAssociationPickerItems(filteredEmpresasAll, assocVisibleCount),
    [filteredEmpresasAll, assocVisibleCount],
  );

  async function handleSubmit() {
    if (submitting) return;
    if (!name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!selectedCompanyId || !selectedCompany) {
      toast.error('Selecciona una asociación');
      return;
    }
    if (!email.trim()) {
      toast.error('El correo es obligatorio');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        cargo: cargo.trim() || undefined,
        company: selectedCompany.name,
        companyId: selectedCompanyId,
        etapaCiclo: 'lead',
        phone: phone.trim(),
        email: email.trim(),
        source: 'base',
        assignedTo,
        estimatedValue: 0,
        clienteRecuperado: 'no',
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      maxWidthClassName="sm:max-w-lg"
      title={title}
      description={description}
      footer={
        <FormDialogActions
          submitting={submitting}
          submitLabel={submitLabel}
          submitDisabled={!name.trim() || !email.trim() || !selectedCompanyId}
          onCancel={() => handleOpenChange(false)}
          onSubmit={() => void handleSubmit()}
        />
      }
    >
      <div className="space-y-6">
          <FormDialogGrid>
            <FormDialogField label="Nombre completo" required>
              <Input
                id="cliente-contacto-name"
                className={formDialogInputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre del contacto"
              />
            </FormDialogField>
            <FormDialogField label="Cargo">
              <Input
                id="cliente-contacto-cargo"
                className={formDialogInputClass}
                value={cargo}
                onChange={(event) => setCargo(event.target.value)}
                placeholder="Ej: Gerente de Compras"
              />
            </FormDialogField>
          </FormDialogGrid>

          <FormDialogField
            label={(
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="size-3.5 text-muted-foreground" />
                Asociación
              </span>
            )}
            required
            compactControl={false}
          >
            {selectedCompany && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <div className="flex items-center gap-1 rounded-md border border-input bg-muted/60 px-2 py-1 text-xs">
                  <Building2 className="size-3" />
                  <span className="max-w-[280px] truncate">{selectedCompany.name}</span>
                  <button
                    type="button"
                    className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => setSelectedCompanyId(null)}
                  >
                    <span className="text-xs leading-none">&times;</span>
                  </button>
                </div>
              </div>
            )}
            <Popover
              open={assocPanelOpen}
              onOpenChange={setAssocPanelOpen}
              modal={false}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={formDialogPickerTriggerClass}
                >
                  {selectedCompany ? 'Cambiar asociación' : 'Buscar asociación'}
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${assocPanelOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="bottom"
                sideOffset={8}
                collisionPadding={16}
                className={formDialogPopoverContentClass}
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <div className="p-3">
                  <div className="relative mb-3">
                    <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={assocSearch}
                      onChange={(event) => setAssocSearch(event.target.value)}
                      className={`${formDialogInputClass} h-10 pl-9 text-sm`}
                    />
                  </div>
                  <div
                    className={cn(formDialogScrollListClass, 'space-y-0.5')}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {filteredEmpresasAll.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                        Sin resultados
                      </p>
                    ) : (
                      filteredEmpresas.map((empresa) => {
                        const isSelected = selectedCompanyId === empresa.id;
                        return (
                          <label
                            key={empresa.id}
                            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 ${isSelected ? 'bg-muted/50' : ''}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              className="size-3.5 shrink-0"
                              onCheckedChange={(checked) => {
                                if (checked === true) {
                                  setSelectedCompanyId(empresa.id);
                                  setAssocPanelOpen(false);
                                  setAssocSearch('');
                                } else {
                                  setSelectedCompanyId(null);
                                }
                              }}
                            />
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate">{empresa.name}</span>
                          </label>
                        );
                      })
                    )}
                    <TaskAssociationPickerLoadMore
                      visibleCount={assocVisibleCount}
                      totalCount={filteredEmpresasAll.length}
                      onShowMore={showMoreAssocItems}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </FormDialogField>

          <FormDialogGrid>
            <FormDialogField label="Correo" required>
              <Input
                id="cliente-contacto-email"
                type="email"
                className={formDialogInputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@empresa.com"
              />
            </FormDialogField>
            <FormDialogField label="Teléfono">
              <Input
                id="cliente-contacto-phone"
                className={formDialogInputClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+51 999 999 999"
              />
            </FormDialogField>
          </FormDialogGrid>

          <AssignedAdvisorFormField
            htmlId="cliente-contacto-assigned-to"
            value={assignedTo}
            onChange={setAssignedTo}
            disabled={!canReassign}
            fallbackName={currentUser.name}
            label="Asesor asignado"
            formStyle
          />
        </div>
    </FormDialogShell>
  );
}
