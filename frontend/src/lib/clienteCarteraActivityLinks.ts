import type { Activity } from '@/types';
import {
  clienteEmpresaIdsFromActivity,
  contactoClienteIdsFromActivity,
} from '@/lib/activityEntityLinks';

/** Tarea o actividad vinculada al módulo Clientes (cartera). */
export function activityIsClienteCartera(a: Activity): boolean {
  return (
    clienteEmpresaIdsFromActivity(a).length > 0 ||
    contactoClienteIdsFromActivity(a).length > 0
  );
}
