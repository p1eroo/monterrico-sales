export type CallOutcomeGroup = 'contacto' | 'no_contacto';

const CALL_RESULT_LABELS: Record<string, string> = {
  contactado: 'Contactado',
  no_contesta: 'No contesta',
  ocupado: 'Ocupado',
  mensaje: 'Dejó mensaje',
};

export function parseCallResultFromDescription(
  description: string | null | undefined,
): string | null {
  if (!description?.trim()) return null;
  const match = description.match(/Resultado:\s*(\w+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function callOutcomeGroupFromResult(
  result: string | null | undefined,
): CallOutcomeGroup {
  if (result?.toLowerCase().trim() === 'contactado') return 'contacto';
  return 'no_contacto';
}

export function callOutcomeLabel(group: CallOutcomeGroup): string {
  return group === 'contacto' ? 'Contacto' : 'No contacto';
}

export function callResultDetailLabel(
  result: string | null | undefined,
): string | null {
  if (!result) return null;
  return CALL_RESULT_LABELS[result.toLowerCase().trim()] ?? null;
}

export function callInteractionTypeKey(
  type: string | null | undefined,
  description: string | null | undefined,
):
  | 'llamadas_contacto'
  | 'llamadas_no_contacto'
  | 'reuniones'
  | 'correos'
  | null {
  const t = type?.toLowerCase().trim() ?? '';
  if (t === 'llamada') {
    const result = parseCallResultFromDescription(description);
    const group = callOutcomeGroupFromResult(result);
    return group === 'contacto' ? 'llamadas_contacto' : 'llamadas_no_contacto';
  }
  if (t === 'reunion' || t === 'reunión') return 'reuniones';
  if (t === 'correo') return 'correos';
  return null;
}
