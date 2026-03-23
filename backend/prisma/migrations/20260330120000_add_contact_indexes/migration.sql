-- Índices en Contact para consultas por assignedTo, etapa y ambos
CREATE INDEX "Contact_assignedTo_idx" ON "Contact"("assignedTo");
CREATE INDEX "Contact_etapa_idx" ON "Contact"("etapa");
CREATE INDEX "Contact_assignedTo_etapa_idx" ON "Contact"("assignedTo", "etapa");
