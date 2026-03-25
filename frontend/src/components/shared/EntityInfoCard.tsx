import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

export function EntityInfoCard({ title, fields, extraContent }: EntityInfoCardProps) {
  return (
    <Card className="min-w-0 gap-2">
      <CardHeader className="-mb-1 -mt-1">
        <CardTitle className="text-[14px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-2.5 pt-0 text-sm">
        {fields.map((field, i) => {
          const hint = field.title ?? (field.truncate ? field.value : undefined);
          const valueClasses = cn(
            field.href && 'text-primary hover:underline',
            (field.icon || field.label || field.href || field.truncate) &&
              'min-w-0 flex-1',
            (field.truncate || field.href) && 'truncate',
          );
          return (
            <div
              key={i}
              className={cn(
                'flex min-w-0 items-center gap-2',
                field.indent && 'pl-6',
              )}
            >
              {field.icon ? (
                <field.icon className="size-4 shrink-0 text-muted-foreground" />
              ) : null}
              {field.label && !field.icon ? (
                <span className="shrink-0 text-muted-foreground">{field.label}</span>
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
      </CardContent>
    </Card>
  );
}
