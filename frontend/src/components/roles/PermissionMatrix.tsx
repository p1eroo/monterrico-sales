import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import type { PermissionKey } from '@/types';
import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
} from '@/data/rbac';
import { cn } from '@/lib/utils';

interface PermissionMatrixProps {
  permissions: Record<PermissionKey, boolean>;
  onChange: (key: PermissionKey, value: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function PermissionMatrix({
  permissions,
  onChange,
  disabled = false,
  compact = false,
}: PermissionMatrixProps) {
  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[500px] border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">
                Módulo
              </th>
              {PERMISSION_ACTIONS.map((act) => (
                <th key={act.id} className="px-3 py-3 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex cursor-help items-center justify-center gap-1 text-xs font-medium">
                        {act.label}
                        <HelpCircle className="size-3.5 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      {act.tooltip}
                    </TooltipContent>
                  </Tooltip>
                </th>
              ))}
              {!compact && (
                <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">
                  Todo
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((mod) => {
              const modKeys = PERMISSION_ACTIONS.map(
                (a) => `${mod.id}.${a.id}` as PermissionKey
              );
              const allChecked = modKeys.every((k) => permissions[k]);

              return (
                <tr
                  key={mod.id}
                  className={cn(
                    'border-b last:border-0 transition-colors',
                    'hover:bg-muted/30'
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-sm">
                    {mod.label}
                  </td>
                  {PERMISSION_ACTIONS.map((act) => {
                    const key = `${mod.id}.${act.id}` as PermissionKey;
                    return (
                      <td key={key} className="px-3 py-2.5 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permissions[key] ?? false}
                            onCheckedChange={(v) =>
                              onChange(key, !!v)
                            }
                            disabled={disabled}
                          />
                        </div>
                      </td>
                    );
                  })}
                  {!compact && (
                    <td className="px-3 py-2.5 text-center">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={() => {
                          const val = !allChecked;
                          modKeys.forEach((k) => onChange(k, val));
                        }}
                        disabled={disabled}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
