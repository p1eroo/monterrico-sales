import type { LucideIcon } from 'lucide-react';
import { Phone, Video, FileText, Mail, RefreshCw, MessageSquare } from 'lucide-react';
import type { CalendarEventType } from '@/types';

export const eventTypeConfig: Record<
  CalendarEventType,
  { label: string; icon: LucideIcon; color: string; bgColor: string }
> = {
  llamada: { label: 'Llamada', icon: Phone, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  reunion: { label: 'Reunión', icon: Video, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  tarea: { label: 'Tarea', icon: FileText, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  correo: { label: 'Correo', icon: Mail, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  seguimiento: { label: 'Seguimiento', icon: RefreshCw, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-100' },
};

export const eventStatusConfig: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-amber-600' },
  completada: { label: 'Completada', color: 'text-emerald-600' },
  en_progreso: { label: 'En progreso', color: 'text-blue-600' },
  vencida: { label: 'Vencida', color: 'text-red-600' },
};
