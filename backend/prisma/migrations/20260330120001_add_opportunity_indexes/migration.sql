-- Índices en Opportunity para pipeline, reportes y consultas por asesor/etapa
CREATE INDEX "Opportunity_assignedTo_idx" ON "Opportunity"("assignedTo");
CREATE INDEX "Opportunity_etapa_idx" ON "Opportunity"("etapa");
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");
CREATE INDEX "Opportunity_assignedTo_etapa_idx" ON "Opportunity"("assignedTo", "etapa");
CREATE INDEX "Opportunity_expectedCloseDate_idx" ON "Opportunity"("expectedCloseDate");
