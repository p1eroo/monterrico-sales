import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogBtnOutlineClass,
  formDialogBtnPrimaryClass,
  formDialogInputClass,
} from '@/components/ui/form-dialog';
import {
  WhatsappTemplatePicker,
  type ChatwootWhatsappTemplate,
} from '@/components/flota/WhatsappTemplatePicker';

export interface WhatsappNewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  name: string;
  onPhoneChange?: (value: string) => void;
  onNameChange?: (value: string) => void;
  phoneReadOnly?: boolean;
  nameReadOnly?: boolean;
  templates: ChatwootWhatsappTemplate[];
  loadingTemplates?: boolean;
  selectedTemplate: string;
  onSelectTemplate: (name: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  title?: string;
  description?: string;
}

export function WhatsappNewMessageDialog({
  open,
  onOpenChange,
  phone,
  name,
  onPhoneChange,
  onNameChange,
  phoneReadOnly = false,
  nameReadOnly = false,
  templates,
  loadingTemplates = false,
  selectedTemplate,
  onSelectTemplate,
  onSubmit,
  submitting = false,
  submitDisabled = false,
  title = 'Nuevo mensaje',
  description = 'Selecciona una plantilla para iniciar la conversación',
}: WhatsappNewMessageDialogProps) {
  const canSubmit = !submitDisabled && !submitting && phone.trim().length > 0;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidthClassName="sm:max-w-xl"
      footer={(
        <div className="flex flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className={formDialogBtnOutlineClass}
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className={formDialogBtnPrimaryClass}
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            {submitting ? 'Enviando...' : 'Enviar plantilla'}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <FormDialogGrid className="gap-y-3 sm:gap-y-4">
          <FormDialogField label="Número" compactControl={phoneReadOnly ? false : true}>
            {phoneReadOnly ? (
              <p className="text-sm font-medium leading-snug text-foreground">{phone}</p>
            ) : (
              <Input
                className={formDialogInputClass}
                value={phone}
                onChange={(e) => onPhoneChange?.(e.target.value)}
                placeholder="+51999999999"
              />
            )}
          </FormDialogField>

          <FormDialogField label="Nombre" compactControl={nameReadOnly ? false : true}>
            {nameReadOnly ? (
              <p className="text-sm font-medium leading-snug text-foreground">{name}</p>
            ) : (
              <Input
                className={formDialogInputClass}
                value={name}
                onChange={(e) => onNameChange?.(e.target.value)}
                placeholder="Nombre del contacto"
              />
            )}
          </FormDialogField>
        </FormDialogGrid>

        <FormDialogField
          label="Plantilla"
          compactControl={false}
          hint="Las plantillas con Flow solo pueden enviarse desde Chatwoot."
        >
          <WhatsappTemplatePicker
            templates={templates}
            loading={loadingTemplates}
            selectedName={selectedTemplate}
            onSelect={onSelectTemplate}
            maxHeightClass="max-h-[min(22rem,42vh)]"
          />
        </FormDialogField>
      </div>
    </FormDialogShell>
  );
}

export interface WhatsappTemplateSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: ChatwootWhatsappTemplate[];
  loadingTemplates?: boolean;
  selectedTemplate: string;
  onSelectTemplate: (name: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  title?: string;
  description?: string;
}

export function WhatsappTemplateSendDialog({
  open,
  onOpenChange,
  templates,
  loadingTemplates = false,
  selectedTemplate,
  onSelectTemplate,
  onSubmit,
  submitting = false,
  title = 'Plantillas de WhatsApp',
  description = 'Seleccione la plantilla de WhatsApp que desea enviar.',
}: WhatsappTemplateSendDialogProps) {
  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidthClassName="sm:max-w-xl"
      footer={(
        <div className="flex flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className={formDialogBtnOutlineClass}
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className={formDialogBtnPrimaryClass}
            onClick={onSubmit}
            disabled={submitting || !selectedTemplate}
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Enviar plantilla
          </Button>
        </div>
      )}
    >
      <WhatsappTemplatePicker
        templates={templates}
        loading={loadingTemplates}
        selectedName={selectedTemplate}
        onSelect={onSelectTemplate}
        maxHeightClass="max-h-[min(26rem,50vh)]"
        sendableOnly
      />
    </FormDialogShell>
  );
}
