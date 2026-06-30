import { api } from './api';

export type GoogleEvent = {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string }[];
  organizer?: { email: string; displayName?: string };
  creator?: { email: string; displayName?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
    conferenceSolution?: { name?: string };
  };
};

export type TaskList = {
  id: string;
  title: string;
};

export type GoogleTask = {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: string;
};

export async function fetchGoogleEvents(maxResults?: number, timeMin?: string, timeMax?: string): Promise<GoogleEvent[]> {
  const params = new URLSearchParams();
  if (maxResults) params.set('maxResults', String(maxResults));
  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);
  const qs = params.toString();
  return api<GoogleEvent[]>(`/google-calendar/events${qs ? `?${qs}` : ''}`);
}

export async function createGoogleEvent(event: {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: { email: string }[];
}): Promise<GoogleEvent> {
  return api<GoogleEvent>('/google-calendar/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function updateGoogleEvent(eventId: string, event: Partial<GoogleEvent>): Promise<GoogleEvent> {
  return api<GoogleEvent>(`/google-calendar/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  });
}

export async function deleteGoogleEvent(eventId: string): Promise<void> {
  await api(`/google-calendar/events/${eventId}`, { method: 'DELETE' });
}

export async function fetchTaskLists(): Promise<TaskList[]> {
  return api<TaskList[]>('/google-calendar/tasklists');
}

export async function createGoogleTask(taskListId: string, title: string, notes?: string, due?: string): Promise<GoogleTask> {
  return api<GoogleTask>('/google-calendar/tasks', {
    method: 'POST',
    body: JSON.stringify({ taskListId, title, notes, due }),
  });
}
