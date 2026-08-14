import { notify } from '@/lib/notify';
import type { CallGoalInfo } from '@/types';

const CALL_GOAL_TOAST_MS = 10_000;

export const CALL_GOAL_TOAST_MOCKS: CallGoalInfo[] = [
  {
    kind: 'meta',
    label: 'Cuentan para meta',
    reason: 'La empresa es un ingreso de esta semana.',
  },
  {
    kind: 'seguimiento',
    label: 'Seguimiento',
    reason:
      'No es ingreso de esta semana ni un lead que entre a la meta: ya venía como prospecto o cliente de semanas anteriores.',
  },
  {
    kind: 'no_contacto',
    label: 'No contacto',
    reason: 'El resultado es «No contesta», no Contactado.',
  },
];

export const CALL_GOAL_TOAST_REASON_MOCKS: CallGoalInfo[] = [
  {
    kind: 'meta',
    label: 'Cuentan para meta',
    reason:
      'Al cierre de la semana pasada la empresa seguía en lead (menos de 10 % de probabilidad).',
  },
  {
    kind: 'meta',
    label: 'Cuentan para meta',
    reason: 'Esta semana la empresa pasó de lead a prospecto.',
  },
  {
    kind: 'seguimiento',
    label: 'Seguimiento',
    reason:
      'Quedó como Contactado, pero no hay empresa comercial vinculada, así que cuenta como seguimiento.',
  },
  {
    kind: 'no_contacto',
    label: 'No contacto',
    reason: 'No se eligió resultado Contactado, así que no cuenta como contacto.',
  },
];

export function showCallGoalToast(info: CallGoalInfo) {
  const options = { duration: CALL_GOAL_TOAST_MS };
  if (info.kind === 'no_contacto') {
    notify.warning(info.label, info.reason, options);
    return;
  }
  if (info.kind === 'meta') {
    notify.success(info.label, info.reason, options);
    return;
  }
  notify.info(info.label, info.reason, options);
}
