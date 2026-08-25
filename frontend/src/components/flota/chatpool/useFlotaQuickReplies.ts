import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FLOTA_QUICK_REPLIES, type QuickReply } from './quickReplies';

const STORAGE_KEY = 'flota-chatpool-quick-replies-v1';

function isQuickReply(value: unknown): value is QuickReply {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.label === 'string' &&
    typeof row.text === 'string' &&
    row.id.trim().length > 0 &&
    row.label.trim().length > 0
  );
}

function loadReplies(): QuickReply[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLOTA_QUICK_REPLIES.map((r) => ({ ...r }));
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_FLOTA_QUICK_REPLIES.map((r) => ({ ...r }));
    const valid = parsed.filter(isQuickReply).map((r) => ({
      id: r.id.trim(),
      label: r.label.trim(),
      text: r.text,
    }));
    return valid.length > 0 ? valid : DEFAULT_FLOTA_QUICK_REPLIES.map((r) => ({ ...r }));
  } catch {
    return DEFAULT_FLOTA_QUICK_REPLIES.map((r) => ({ ...r }));
  }
}

function persist(replies: QuickReply[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(replies));
}

export function useFlotaQuickReplies() {
  const [replies, setReplies] = useState<QuickReply[]>(() => loadReplies());

  useEffect(() => {
    persist(replies);
  }, [replies]);

  const createReply = useCallback((input: { label: string; text: string }) => {
    const label = input.label.trim();
    const text = input.text.trim();
    if (!label) throw new Error('El título es obligatorio');
    if (!text) throw new Error('El contenido es obligatorio');

    const reply: QuickReply = {
      id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      text,
    };
    setReplies((prev) => [...prev, reply]);
    return reply;
  }, []);

  const updateReply = useCallback((id: string, input: { label: string; text: string }) => {
    const label = input.label.trim();
    const text = input.text.trim();
    if (!label) throw new Error('El título es obligatorio');
    if (!text) throw new Error('El contenido es obligatorio');

    setReplies((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label, text } : r)),
    );
  }, []);

  const deleteReply = useCallback((id: string) => {
    setReplies((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const resetToDefaults = useCallback(() => {
    setReplies(DEFAULT_FLOTA_QUICK_REPLIES.map((r) => ({ ...r })));
  }, []);

  return {
    replies,
    createReply,
    updateReply,
    deleteReply,
    resetToDefaults,
  };
}
