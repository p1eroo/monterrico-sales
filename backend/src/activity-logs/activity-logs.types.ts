export type ActivityActor = { userId: string; userName: string };

export type RecordActivityInput = {
  action: string;
  module: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  description: string;
  status?: 'exito' | 'fallido' | 'pendiente';
  isCritical?: boolean;
};
