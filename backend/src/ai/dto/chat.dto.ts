export type ChatContextDto = {
  userId?: string;
  currentPage?: string;
  userRole?: string;
  /** contact | company | opportunity | undefined */
  selectedEntityType?: string;
  selectedEntityId?: string;
};

/** Turnos previos (sin el mensaje actual). Mismo orden que en pantalla. */
export type ChatHistoryItemDto = {
  role: 'user' | 'assistant';
  content: string;
};

export class ChatDto {
  message!: string;
  context?: ChatContextDto;
  /** Últimos mensajes antes del `message` actual (memoria multi-turno). */
  history?: ChatHistoryItemDto[];
}
