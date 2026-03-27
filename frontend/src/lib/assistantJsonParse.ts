import type { AiChatAction, AiChatLink } from '@/lib/aiChatApi';
import type { AssistantMessage } from '@/store/assistantStore';

function stripMarkdownJsonFence(content: string): string {
  let trimmed = content.trim();
  if (trimmed.startsWith('```')) {
    const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m?.[1]) trimmed = m[1].trim();
  }
  return trimmed;
}

function normalizeJsonLikeQuotes(s: string): string {
  return s
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'");
}

function extractFirstBalancedJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

type Envelope = {
  message: string;
  links?: AiChatLink[];
  actions?: AiChatAction[];
};

function tryParseEnvelope(s: string): Envelope | null {
  for (const candidate of [s, normalizeJsonLikeQuotes(s)]) {
    try {
      const j = JSON.parse(candidate) as Envelope;
      if (typeof j.message === 'string') {
        return {
          message: j.message,
          links: Array.isArray(j.links) ? j.links : undefined,
          actions: Array.isArray(j.actions) ? j.actions : undefined,
        };
      }
    } catch {
      /* siguiente */
    }
  }
  return null;
}

/** Intenta interpretar el texto del asistente como envelope JSON (misma lógica que el backend). */
export function tryParseAssistantEnvelope(raw: string): Envelope | null {
  const trimmed = stripMarkdownJsonFence(raw.trim());
  const direct = tryParseEnvelope(trimmed);
  if (direct) return direct;
  const extracted = extractFirstBalancedJsonObject(trimmed);
  if (extracted) {
    return tryParseEnvelope(extracted);
  }
  return null;
}

export function getAssistantMessageDisplay(m: AssistantMessage): {
  text: string;
  links?: AiChatLink[];
  actions?: AiChatAction[];
} {
  if (m.role !== 'assistant') {
    return { text: m.content };
  }
  const parsed = tryParseAssistantEnvelope(m.content);
  const useEnvelope =
    parsed !== null && m.content.trimStart().startsWith('{');
  const text = useEnvelope ? parsed.message : m.content;
  const links =
    m.links && m.links.length > 0
      ? m.links
      : useEnvelope
        ? parsed.links
        : m.links;
  const actions =
    m.actions && m.actions.length > 0
      ? m.actions
      : useEnvelope
        ? parsed.actions
        : m.actions;
  return { text, links, actions };
}
