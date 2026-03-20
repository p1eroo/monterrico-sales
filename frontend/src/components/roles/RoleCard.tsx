import { Users, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import type { RBACRole } from '@/types';
import { cn } from '@/lib/utils';

interface RoleCardProps {
  role: RBACRole;
  onEdit?: (role: RBACRole) => void;
  isDefault?: boolean;
}

export function RoleCard({ role, onEdit, isDefault }: RoleCardProps) {
  const grantedCount = Object.values(role.permissions).filter(Boolean).length;
  const totalCount = Object.keys(role.permissions).length;
  const summary = `${grantedCount}/${totalCount} permisos`;

  return (
    <Card
      className={cn(
        'py-0 transition-all hover:shadow-md',
        isDefault && 'ring-1 ring-[#13944C]/20'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#13944C]/10">
              <Shield className="size-5 text-[#13944C]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{role.name}</h3>
                {role.templateId && (
                  <Badge variant="secondary" className="text-[10px]">
                    Base
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {role.description}
              </p>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {role.userCount} usuario{role.userCount !== 1 ? 's' : ''}
                </span>
                <span>{summary}</span>
              </div>
            </div>
          </div>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => onEdit(role)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
