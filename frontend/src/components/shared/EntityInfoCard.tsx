import { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface InfoField {
  icon?: LucideIcon;
  label?: string;
  value: string;
  href?: string;
  indent?: boolean;
  /** Una sola línea; el sobrante se muestra como "…". Usa `title` para el texto completo al hover. */
  truncate?: boolean;
  title?: string;
}

interface EntityInfoCardProps {
  title: string;
  fields: InfoField[];
  extraContent?: React.ReactNode;
  collapsible?: boolean;
  /** Por defecto abierto en panel lateral de detalle; usar `false` para iniciar colapsado. */
  defaultOpen?: boolean;
}

export function EntityInfoCard({
  title,
  fields,
  extraContent,
  collapsible = false,
  defaultOpen = true,
}: EntityInfoCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const content = (
    <div className={cn(collapsible ? 'crm-info-list' : 'min-w-0 space-y-3 text-sm text-text-secondary')}>
      {fields.map((field, i) => {
        const hint = field.title ?? (field.truncate ? field.value : undefined);
        const valueClasses = cn(
          collapsible
            ? 'crm-info-value'
            : !field.href && 'text-text-primary',
          field.href &&
            (collapsible
              ? 'crm-info-link'
              : 'text-primary hover:text-primary/90 hover:underline'),
          (field.icon || field.label || field.href || field.truncate) &&
            'min-w-0 flex-1',
          collapsible && (field.truncate || field.href) && 'crm-info-value--truncate',
          !collapsible && (field.truncate || field.href) && 'truncate',
        );
        return (
          <div
            key={i}
            className={cn(
              collapsible
                ? 'crm-info-row'
                : 'flex min-w-0 items-center gap-2.5',
              field.indent && (collapsible ? 'crm-info-row--indented' : 'pl-6'),
            )}
          >
            {field.icon ? (
              <field.icon
                className={cn(
                  collapsible ? 'crm-info-icon' : 'size-4 shrink-0 text-text-tertiary',
                )}
              />
            ) : null}
            {field.label && !field.icon ? (
              <span className={cn(collapsible ? 'crm-info-label' : 'shrink-0 text-text-secondary')}>
                {field.label}
              </span>
            ) : null}
            {field.href ? (
              <a href={field.href} title={hint} className={valueClasses}>
                {field.value}
              </a>
            ) : (
              <span title={hint} className={valueClasses}>
                {field.value}
              </span>
            )}
          </div>
        );
      })}
      {extraContent}
    </div>
  );

  if (collapsible) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="crm-collapsible-card">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="crm-collapsible-card__trigger"
            >
              <span className="crm-collapsible-card__title">
                {title}
              </span>
              <ChevronDown
                className={cn(
                  'crm-collapsible-card__chevron',
                  open && 'rotate-180',
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="crm-collapsible-card__content">
            <CardContent className="p-0">
              {content}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className="min-w-0 gap-2 border-border/70 bg-surface-elevated shadow-none">
      <CardHeader className="-mb-1 -mt-1">
        <CardTitle className="text-[14px] text-text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 pt-0">
        {content}
      </CardContent>
    </Card>
  );
}
