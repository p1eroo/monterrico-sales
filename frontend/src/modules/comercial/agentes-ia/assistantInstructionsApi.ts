import { api } from '@/lib/api';

export type AssistantInstructionsDto = {
  instructionsChatTools: string;
  instructionsStream: string;
  updatedAt: string;
  updatedByUserId: string | null;
};

export async function fetchAssistantInstructions(): Promise<AssistantInstructionsDto> {
  return api<AssistantInstructionsDto>('/api/ai/assistant-instructions');
}

export async function patchAssistantInstructions(
  body: Partial<
    Pick<
      AssistantInstructionsDto,
      'instructionsChatTools' | 'instructionsStream'
    >
  >,
): Promise<AssistantInstructionsDto> {
  return api<AssistantInstructionsDto>('/api/ai/assistant-instructions', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
