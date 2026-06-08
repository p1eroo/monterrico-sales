/**
 * Cuerpo PATCH /api/ai/assistant-instructions (campos opcionales).
 * Validación adicional en AssistantInstructionsService (longitud).
 */
export class UpdateAssistantInstructionsDto {
  instructionsChatTools?: string;
  instructionsStream?: string;
}
