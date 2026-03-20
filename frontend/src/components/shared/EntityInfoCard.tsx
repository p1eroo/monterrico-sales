import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface InfoField {
  icon?: LucideIcon;
  label?: string;
  value: string;
  href?: string;
  indent?: boolean;
}

interface EntityInfoCardProps {
  title: string;
  fields: InfoField[];
  extraContent?: React.ReactNode;
}

export function EntityInfoCard({ title, fields, extraContent }: EntityInfoCardProps) {
  return (
    <Card className="gap-2">
      <CardHeader className="-mb-1 -mt-1">
        <CardTitle className="text-[14px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm pt-0">
        {fields.map((field, i) => (
          <div key={i} className={`flex items-center gap-2 ${field.indent ? 'pl-6' : ''}`}>
            {field.icon && <field.icon className="size-4 text-muted-foreground" />}
            {field.label && !field.icon && (
              <span className="text-muted-foreground">{field.label}</span>
            )}
            {field.href ? (
              <a href={field.href} className="text-primary hover:underline truncate">{field.value}</a>
            ) : (
              <span>{field.value}</span>
            )}
          </div>
        ))}
        {extraContent}
      </CardContent>
    </Card>
  );
}
