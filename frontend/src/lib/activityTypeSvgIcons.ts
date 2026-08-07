import type { ComponentType } from 'react';
import { CheckSquare, StickyNote } from 'lucide-react';
import { Buildings2SvgIcon } from '@/components/icons/Buildings2SvgIcon';
import { CalendarSvgIcon } from '@/components/icons/CalendarSvgIcon';
import { CorreoSvgIcon } from '@/components/icons/CorreoSvgIcon';
import { LlamadaSvgIcon } from '@/components/icons/LlamadaSvgIcon';
import { ReunionSvgIcon } from '@/components/icons/ReunionSvgIcon';
import { SuitcaseSvgIcon } from '@/components/icons/SuitcaseSvgIcon';
import { UsersGroupTwoRoundedSvgIcon } from '@/components/icons/UsersGroupTwoRoundedSvgIcon';
import { WhatsAppSvgIcon } from '@/components/icons/WhatsAppSvgIcon';

export type SvgIconComponent = ComponentType<{ className?: string }>;

/** Misma clase que metadatos en tarjetas del kanban de tareas. */
export const TASK_META_ICON_CLASS =
  'size-4 shrink-0 text-[#72808f] dark:text-gray-500';

export const ACTIVITY_TYPE_SVG_ICONS: Record<string, SvgIconComponent> = {
  llamada: LlamadaSvgIcon,
  reunion: ReunionSvgIcon,
  correo: CorreoSvgIcon,
  whatsapp: WhatsAppSvgIcon,
  tarea: CheckSquare,
  nota: StickyNote,
};

export function activityTypeSvgIcon(type: string | undefined | null): SvgIconComponent {
  const key = type?.trim().toLowerCase() ?? '';
  return ACTIVITY_TYPE_SVG_ICONS[key] ?? LlamadaSvgIcon;
}

export const TaskEntityMetaIcons = {
  calendar: CalendarSvgIcon,
  contact: UsersGroupTwoRoundedSvgIcon,
  company: Buildings2SvgIcon,
  opportunity: SuitcaseSvgIcon,
} as const;
