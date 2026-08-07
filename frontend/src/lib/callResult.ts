export type CallOutcomeGroup = 'contacto' | 'no_contacto';

export const CALL_RESULT_OPTIONS = [
  { value: 'contactado', label: 'Contactado', group: 'contacto' as const },
  { value: 'no_contesta', label: 'No contesta', group: 'no_contacto' as const },
  { value: 'ocupado', label: 'Ocupado', group: 'no_contacto' as const },
  { value: 'mensaje', label: 'Dejó mensaje', group: 'no_contacto' as const },
] as const;

const CALL_RESULT_LABELS = Object.fromEntries(
  CALL_RESULT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>;

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
