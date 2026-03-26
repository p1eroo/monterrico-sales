import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';
import type { ChatHistoryItemDto } from './dto/chat.dto';

/** Debe coincidir con `ai.service.ts` (tests de recorte de historial). */
const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_TOTAL_CHARS = 24_000;
const MAX_SINGLE_HISTORY_CONTENT = 8_000;

describe('AiService', () => {
  let service: AiService;
  let configGet: jest.Mock;
  let deleteMany: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn();
    deleteMany = jest.fn().mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: { get: configGet } },
        {
          provide: PrismaService,
          useValue: {
            aiMessage: { deleteMany },
          },
        },
        { provide: AiToolsService, useValue: {} },
      ],
    }).compile();

    service = module.get(AiService);
  });

  const sanitize = (history: ChatHistoryItemDto[] | undefined) =>
    (
      service as unknown as {
        sanitizeHistory: (
          h: ChatHistoryItemDto[] | undefined,
        ) => { role: 'user' | 'assistant'; content: string }[];
      }
    ).sanitizeHistory(history);

  const maybePrune = (conversationId: string) =>
    (
      service as unknown as {
        maybePruneConversationMessages: (id: string) => Promise<void>;
      }
    ).maybePruneConversationMessages(conversationId);

  describe('sanitizeHistory', () => {
    it('devuelve [] si no hay historial', () => {
      expect(sanitize(undefined)).toEqual([]);
      expect(sanitize([])).toEqual([]);
    });

    it('solo acepta user/assistant; omite vacíos y otros roles', () => {
      expect(
        sanitize(
          [
            { role: 'user', content: '  ' },
            { role: 'system', content: 'x' },
            { role: 'assistant', content: 'ok' },
          ] as unknown as ChatHistoryItemDto[],
        ),
      ).toEqual([{ role: 'assistant', content: 'ok' }]);
    });

    it('fusiona turnos consecutivos del mismo rol', () => {
      expect(
        sanitize([
          { role: 'user', content: 'hola' },
          { role: 'user', content: 'mundo' },
          { role: 'assistant', content: 'hey' },
        ]),
      ).toEqual([
        { role: 'user', content: 'hola\n\nmundo' },
        { role: 'assistant', content: 'hey' },
      ]);
    });

    it('recorta un mensaje que supera el máximo por turno', () => {
      const long = 'x'.repeat(MAX_SINGLE_HISTORY_CONTENT + 50);
      const out = sanitize([{ role: 'user', content: long }]);
      expect(out).toHaveLength(1);
      expect(out[0].content).toHaveLength(MAX_SINGLE_HISTORY_CONTENT + 1);
      expect(out[0].content.endsWith('…')).toBe(true);
    });

    it('conserva solo los últimos N mensajes (tras fusiones)', () => {
      const items: ChatHistoryItemDto[] = [];
      for (let i = 0; i < MAX_HISTORY_MESSAGES + 6; i++) {
        items.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: String(i),
        });
      }
      const out = sanitize(items);
      expect(out).toHaveLength(MAX_HISTORY_MESSAGES);
      expect(out[0].content).toBe('6');
      expect(out[out.length - 1].content).toBe(
        String(MAX_HISTORY_MESSAGES + 5),
      );
    });

    it('recorta por el total de caracteres eliminando desde el inicio', () => {
      const chunk = 'a'.repeat(1_000);
      const items: ChatHistoryItemDto[] = [];
      for (let i = 0; i < 25; i++) {
        items.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: chunk,
        });
      }
      const out = sanitize(items);
      const total = out.reduce((acc, m) => acc + m.content.length, 0);
      expect(total).toBeLessThanOrEqual(MAX_HISTORY_TOTAL_CHARS);
      expect(out.length).toBe(24);
    });
  });

  describe('maybePruneConversationMessages', () => {
    it('no llama a deleteMany si la variable no está definida', async () => {
      configGet.mockReturnValue(undefined);
      await maybePrune('conv-1');
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it('no llama a deleteMany si el valor no es un entero positivo', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_RETENTION_DAYS') return '0';
        return undefined;
      });
      await maybePrune('conv-1');
      expect(deleteMany).not.toHaveBeenCalled();

      configGet.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_RETENTION_DAYS') return '-1';
        return undefined;
      });
      await maybePrune('conv-1');
      expect(deleteMany).not.toHaveBeenCalled();

      configGet.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_RETENTION_DAYS') return 'abc';
        return undefined;
      });
      await maybePrune('conv-1');
      expect(deleteMany).not.toHaveBeenCalled();
    });

    it('borra mensajes con createdAt anterior al corte (N días)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));

      configGet.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_RETENTION_DAYS') return '30';
        return undefined;
      });

      await maybePrune('conv-xyz');

      const expectedCutoff = new Date('2025-06-15T12:00:00.000Z');
      expectedCutoff.setDate(expectedCutoff.getDate() - 30);

      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-xyz',
          createdAt: { lt: expectedCutoff },
        },
      });

      jest.useRealTimers();
    });

    it('registra evento cuando se borran filas', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      configGet.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_RETENTION_DAYS') return '7';
        return undefined;
      });
      deleteMany.mockResolvedValueOnce({ count: 3 });

      await maybePrune('conv-a');

      expect(logSpy).toHaveBeenCalled();
      const payload = logSpy.mock.calls.find(
        (c) =>
          typeof c[0] === 'string' && c[0].includes('ai.retention.pruned'),
      );
      expect(payload?.[0]).toContain('"deleted":3');
      expect(payload?.[0]).toContain('"conversationId":"conv-a"');

      logSpy.mockRestore();
    });
  });
});
