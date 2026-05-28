import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import type { PermissionKey, PermissionModule, PermissionAction } from '@/types';
import {
  PERMISSION_MODULES,
  MODULE_ALLOWED_ACTIONS,
  PERMISSION_ACTIONS,
  moduleAllowsAction,
} from '@/data/rbac';
import { cn } from '@/lib/utils';

interface PermissionMatrixProps {
  permissions: Record<PermissionKey, boolean>;
  onChange: (key: PermissionKey, value: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  filterArea?: 'comercial' | 'flota' | 'general';
}

export function PermissionMatrix({
  permissions,
  onChange,
  disabled = false,
  compact = false,
  filterArea = 'comercial',
}: PermissionMatrixProps) {
  const filteredModules = PERMISSION_MODULES.filter(
    (mod) => mod.area === filterArea
  );

  const visibleActions = useMemo(() => {
    const actionSet = new Set<string>();
    for (const mod of filteredModules) {
      const modActions = MODULE_ALLOWED_ACTIONS[mod.id as PermissionModule];
      if (modActions) {
        modActions.forEach((a) => actionSet.add(a));
      }
    }
    return PERMISSION_ACTIONS.filter((a) => actionSet.has(a.id));
  }, [filteredModules]);

  return (
    <TooltipProvider>
      <div className="overflow-auto rounded-lg border bg-card scrollbar-thin max-h-[calc(100vh-18rem)] max-w-full">
        <table className="w-full min-w-[500px] border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">
                Módulo
              </th>
              {visibleActions.map((act) => (
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
            {filteredModules.map((mod) => {
              const modId = mod.id as PermissionModule;
              const modKeys = visibleActions
                .filter((a) => moduleAllowsAction(modId, a.id as PermissionAction))
                .map((a) => `${mod.id}.${a.id}` as PermissionKey);
              const allChecked =
                modKeys.length > 0 && modKeys.every((k) => permissions[k]);

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
                  {visibleActions.map((act) => {
                    const key = `${mod.id}.${act.id}` as PermissionKey;
                    const allowed = moduleAllowsAction(
                      modId,
                      act.id as PermissionAction,
                    );
                    if (!allowed) {
                      return (
                        <td
                          key={key}
                          className="px-3 py-2.5 text-center text-muted-foreground"
                        >
                          <span className="text-xs tabular-nums">—</span>
                        </td>
                      );
                    }
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
                      {modKeys.length > 0 ? (
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={() => {
                            const val = !allChecked;
                            modKeys.forEach((k) => onChange(k, val));
                          }}
                          disabled={disabled}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
