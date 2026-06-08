import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ASSISTANT_INSTRUCTION_ROW_ID,
  DEFAULT_INSTRUCTIONS_CHAT_TOOLS_BODY,
  DEFAULT_INSTRUCTIONS_STREAM_BODY,
} from './assistant-instructions.defaults';

export type AssistantInstructionsPublicDto = {
  instructionsChatTools: string;
  instructionsStream: string;
  updatedAt: string;
  updatedByUserId: string | null;
};

@Injectable()
export class AssistantInstructionsService {
  /** Límite por campo (evita prompts enormes y coste de tokens). */
  static readonly MAX_FIELD_CHARS = 28_000;

  constructor(private readonly prisma: PrismaService) {}

  private clampField(raw: string): string {
    const s = raw.replace(/\r\n/g, '\n');
    if (s.length > AssistantInstructionsService.MAX_FIELD_CHARS) {
      throw new BadRequestException(
        `Cada campo admite como mucho ${AssistantInstructionsService.MAX_FIELD_CHARS} caracteres.`,
      );
    }
    return s;
  }

  private async ensureRow() {
    let row = await this.prisma.aiAssistantInstruction.findUnique({
      where: { id: ASSISTANT_INSTRUCTION_ROW_ID },
    });
    if (!row) {
      row = await this.prisma.aiAssistantInstruction.create({
        data: {
          id: ASSISTANT_INSTRUCTION_ROW_ID,
          instructionsChatTools: DEFAULT_INSTRUCTIONS_CHAT_TOOLS_BODY,
          instructionsStream: DEFAULT_INSTRUCTIONS_STREAM_BODY,
        },
      });
    }
    return row;
  }

  async getForApi(): Promise<AssistantInstructionsPublicDto> {
    const row = await this.ensureRow();
    return {
      instructionsChatTools: row.instructionsChatTools,
      instructionsStream: row.instructionsStream,
      updatedAt: row.updatedAt.toISOString(),
      updatedByUserId: row.updatedByUserId,
    };
  }

  /** Lectura para armar prompts OpenAI (sin ensure create si migración ya corrió). */
  async getForPromptAssembly(): Promise<{
    instructionsChatTools: string;
    instructionsStream: string;
  }> {
    const row = await this.prisma.aiAssistantInstruction.findUnique({
      where: { id: ASSISTANT_INSTRUCTION_ROW_ID },
    });
    if (!row) {
      return {
        instructionsChatTools: DEFAULT_INSTRUCTIONS_CHAT_TOOLS_BODY,
        instructionsStream: DEFAULT_INSTRUCTIONS_STREAM_BODY,
      };
    }
    return {
      instructionsChatTools: row.instructionsChatTools,
      instructionsStream: row.instructionsStream,
    };
  }

  async update(
    body: {
      instructionsChatTools?: string;
      instructionsStream?: string;
    },
    editorUserId: string,
  ): Promise<AssistantInstructionsPublicDto> {
    if (
      body.instructionsChatTools === undefined &&
      body.instructionsStream === undefined
    ) {
      throw new BadRequestException(
        'Envía al menos uno de: instructionsChatTools, instructionsStream.',
      );
    }

    await this.ensureRow();

    const data: {
      instructionsChatTools?: string;
      instructionsStream?: string;
      updatedByUserId: string;
    } = { updatedByUserId: editorUserId };

    if (body.instructionsChatTools !== undefined) {
      data.instructionsChatTools = this.clampField(body.instructionsChatTools);
    }
    if (body.instructionsStream !== undefined) {
      data.instructionsStream = this.clampField(body.instructionsStream);
    }

    const row = await this.prisma.aiAssistantInstruction.update({
      where: { id: ASSISTANT_INSTRUCTION_ROW_ID },
      data,
    });

    return {
      instructionsChatTools: row.instructionsChatTools,
      instructionsStream: row.instructionsStream,
      updatedAt: row.updatedAt.toISOString(),
      updatedByUserId: row.updatedByUserId,
    };
  }
}
