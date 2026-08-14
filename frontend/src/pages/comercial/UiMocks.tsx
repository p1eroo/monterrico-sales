import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CALL_GOAL_TOAST_MOCKS,
  CALL_GOAL_TOAST_REASON_MOCKS,
  showCallGoalToast,
} from '@/lib/callGoalToast';
import type { CallGoalInfo } from '@/types';

function toastVariant(kind: CallGoalInfo['kind']): 'success' | 'info' | 'warning' {
  if (kind === 'meta') return 'success';
  if (kind === 'no_contacto') return 'warning';
  return 'info';
}

function ToastPreview({ info }: { info: CallGoalInfo }) {
  const variant = toastVariant(info.kind);
  return (
    <div className="crm-toast-preview" role="status">
      <span className={`crm-toast__icon-badge crm-toast__icon-badge--${variant}`}>
        {variant === 'success' ? (
          <CircleCheckIcon className="size-4 text-primary" strokeWidth={2.25} />
        ) : variant === 'warning' ? (
          <TriangleAlertIcon className="size-4 text-warning" strokeWidth={2.25} />
        ) : (
          <InfoIcon className="size-4 text-info" strokeWidth={2.25} />
        )}
      </span>
      <div className="crm-toast__content">
        <p className="crm-toast__title">{info.label}</p>
        <p className="crm-toast__description">{info.reason}</p>
      </div>
      <span className="crm-toast__close" aria-hidden>
        <X className="size-3.5" strokeWidth={2} />
      </span>
    </div>
  );
}

export default function UiMocks() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Mocks de UI"
        description="Previsualiza avisos del CRM con el mismo estilo del sistema. El toast real sale arriba a la derecha y dura 10 segundos."
      />

      <Card>
        <CardHeader>
          <CardTitle>Toast al registrar una llamada</CardTitle>
          <CardDescription>
            Así se ve al guardar una llamada completada: si cuenta para meta, seguimiento o no contacto, y el motivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {CALL_GOAL_TOAST_MOCKS.map((info) => (
              <div key={info.kind} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <ToastPreview info={info} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 sm:mt-2"
                  onClick={() => showCallGoalToast(info)}
                >
                  Mostrar toast
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-border/60 pt-5">
            <p className="text-sm font-medium">Otros motivos</p>
            <p className="text-xs text-muted-foreground">
              Misma pinta; cambia el texto según la empresa y el resultado de la llamada.
            </p>
            {CALL_GOAL_TOAST_REASON_MOCKS.map((info) => (
              <div key={info.reason} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <ToastPreview info={info} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 sm:mt-2"
                  onClick={() => showCallGoalToast(info)}
                >
                  Mostrar toast
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
