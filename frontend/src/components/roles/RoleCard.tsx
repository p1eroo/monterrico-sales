import { Users, Shield, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RBACRole, PermissionKey } from '@/types';
import { allValidPermissionKeys } from '@/data/rbac';
import { cn } from '@/lib/utils';

interface RoleCardProps {
  role: RBACRole;
  onEdit?: (role: RBACRole) => void;
  onDelete?: (role: RBACRole) => void;
  isDefault?: boolean;
}

export function RoleCard({ role, onEdit, onDelete, isDefault }: RoleCardProps) {
  const validKeys = allValidPermissionKeys();
  const grantedCount = validKeys.filter(
    (k) => role.permissions[k as PermissionKey],
  ).length;
  const totalCount = validKeys.length;
  const summary = `${grantedCount}/${totalCount} permisos`;

  return (
    <Card
      className={cn(
        'py-0 transition-all hover:border-primary/35 dark:hover:shadow-md',
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
          <div className="flex shrink-0 items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(role)}
              >
                <Pencil className="size-4" />
              </Button>
            )}
            {onDelete && !isDefault && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(role)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
