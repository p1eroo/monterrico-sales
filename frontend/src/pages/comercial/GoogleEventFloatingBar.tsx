import { useState } from 'react';
import { Video, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { contactListAll, contactCreate } from '@/lib/contactApi';
import { companyListAll } from '@/lib/companyApi';
import { useAppStore } from '@/store';
import type { CalendarEvent } from '@/types';
import type { CreateActivityPayload } from '@/lib/activityApi';

type LinkState = 'idle' | 'loading' | 'success' | 'error';
const TIMEOUT_MS = 30_000;

export function GoogleEventFloatingBar({ event, createActivity }: { event: CalendarEvent; createActivity: (data: CreateActivityPayload) => Promise<any> }) {
  const [state, setState] = useState<LinkState>('idle');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(0);
  const currentUser = useAppStore((s) => s.currentUser);

  async function handleLink() {
    setState('loading');
    setMessage('Vinculando evento al CRM...');
    toast.loading('Iniciando vinculación...', { id: 'google-float-toast' });
    try {
      const attendees = event.attendees ?? [];
      if (attendees.length === 0) { setMessage('El evento no tiene invitados'); setState('error'); return; }

      const allContacts = await contactListAll();
      const allCompanies = await companyListAll();
      let successCount = 0;

      for (const a of attendees) {
        if (!a.email || a.organizer) continue;
        const domain = a.email.split('@')[1].toLowerCase();
        setMessage(`Procesando: ${a.name || a.email}...`);

        const existing = allContacts.find((c) => c.correo === a.email);
        let contactId: string | undefined;
        let companyId: string | undefined;

        if (existing) {
          contactId = existing.id;
        } else {
          const existingCompany = allCompanies.find((c) => c.domain?.toLowerCase() === domain);
          if (existingCompany) {
            const created = await contactCreate({ name: a.name || a.email, correo: a.email, fuente: 'base', etapa: 'lead', companyId: existingCompany.id });
            contactId = created.id;
            companyId = existingCompany.id;
          } else {
            const created = await contactCreate({ name: a.name || a.email, correo: a.email, fuente: 'base', etapa: 'lead', newCompany: { name: domain, facturacionEstimada: 2000, fuente: 'base' } });
            contactId = created.id;
          }
        }

        await createActivity({ type: 'reunion', title: event.title, description: event.description ?? '', assignedTo: currentUser.id, dueDate: event.date, startDate: event.date, startTime: event.startTime, contactId, companyId });
        successCount++;
      }

      setCount(successCount);
      setState('success');
      setMessage(`${successCount} actividad${successCount !== 1 ? 'es' : ''} creada${successCount !== 1 ? 's' : ''}`);
      toast.dismiss('google-float-toast');
      toast.success(`${successCount} actividad${successCount !== 1 ? 'es' : ''} vinculada${successCount !== 1 ? 's' : ''}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al vincular');
      setState('error');
      toast.dismiss('google-float-toast');
      toast.error(e instanceof Error ? e.message : 'Error al vincular evento');
    }
  }

  return (
    <div className="w-full">
      {state === 'idle' && (
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={() => void handleLink()}
            className="rounded-md border border-[#13944C] px-4 py-2 text-sm font-medium text-[#13944C] hover:bg-[#13944C]/5 transition-colors"
          >
            Vincular ahora
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 shrink-0 animate-spin text-blue-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-blue-900">Vinculando...</p>
            <p className="text-xs text-blue-700 truncate">{message}</p>
          </div>
        </div>
      )}

      {state === 'success' && (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-green-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-green-900">¡Vinculado!</p>
            <p className="text-xs text-green-700">{message}</p>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <XCircle className="size-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-xs text-red-700 truncate">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}