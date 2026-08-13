import { parseCallResultFromDescription } from '@/lib/callResult';
import type { UpdateActivityPayload } from '@/lib/activityApi';
import type { Activity } from '@/types';

const METADATA_LINE = /^(Duración|Resultado|Modalidad):\s*/i;

function parseMetadataValue(description: string, key: string): string {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'i');
  for (const line of (description ?? '').split('\n')) {
    const match = line.trim().match(re);
    if (match) return match[1].trim();
  }
  return '';
}

export function parseActivityDescriptionSummary(description: string): string {
  return (description ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !METADATA_LINE.test(line))
    .join('\n')
    .trim();
}

function parseDurationFromDescription(description: string): string {
  const raw = parseMetadataValue(description, 'Duración');
  const match = raw.match(/(\d+)/);
  return match?.[1] ?? '';
}

export type ActivityEditFormState = {
  title: string;
  type: string;
  assignedTo: string;
  summary: string;
  date: string;
  time: string;
  duration: string;
  callResult: string;
  dateTime: string;
  meetingType: string;
  meetingResult: string;
};

export function activityToEditForm(activity: Activity): ActivityEditFormState {
  const type = activity.type?.toLowerCase().trim() ?? '';
  const description = activity.description ?? '';
  const date = activity.startDate || activity.dueDate || '';
  const time = activity.startTime || '';

  return {
    title: activity.title ?? '',
    type,
    assignedTo: activity.assignedTo ?? '',
    summary: parseActivityDescriptionSummary(description),
    date,
    time,
    duration: parseDurationFromDescription(description),
    callResult: parseCallResultFromDescription(description) ?? '',
    dateTime: date ? `${date}T${time || '09:00'}` : '',
    meetingType: parseMetadataValue(description, 'Modalidad'),
    meetingResult: parseMetadataValue(description, 'Resultado'),
  };
}

export function buildActivityUpdatePayload(
  form: ActivityEditFormState,
  opts?: { includeAssignedTo?: boolean },
): UpdateActivityPayload {
  const type = form.type.trim().toLowerCase();
  const extra: string[] = [];
  let dueDate = form.date.trim();
  let startDate = form.date.trim();
  let startTime = form.time.trim() || undefined;

  if (type === 'llamada') {
    if (form.duration.trim()) extra.push(`Duración: ${form.duration.trim()} min`);
    if (form.callResult.trim()) extra.push(`Resultado: ${form.callResult.trim()}`);
  } else if (type === 'reunion') {
    const dt = form.dateTime.trim();
    if (dt) {
      dueDate = dt.slice(0, 10);
      startDate = dt.slice(0, 10);
      startTime = dt.length >= 16 ? dt.slice(11, 16) : undefined;
    }
    if (form.meetingType.trim()) extra.push(`Modalidad: ${form.meetingType.trim()}`);
    if (form.meetingResult.trim()) extra.push(`Resultado: ${form.meetingResult.trim()}`);
  }

  const description = [form.summary.trim(), ...extra].filter(Boolean).join('\n');

  const payload: UpdateActivityPayload = {
    type,
    title: form.title.trim(),
    description,
  };

  if (opts?.includeAssignedTo !== false && form.assignedTo.trim()) {
    payload.assignedTo = form.assignedTo.trim();
  }
  if (dueDate) payload.dueDate = dueDate;
  if (startDate) payload.startDate = startDate;
  if (startTime) payload.startTime = startTime;

  return payload;
}
