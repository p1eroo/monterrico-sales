-- Índices en Activity para calendario y tareas por asesor/fecha
CREATE INDEX "Activity_assignedTo_idx" ON "Activity"("assignedTo");
CREATE INDEX "Activity_dueDate_idx" ON "Activity"("dueDate");
CREATE INDEX "Activity_status_idx" ON "Activity"("status");
CREATE INDEX "Activity_assignedTo_dueDate_idx" ON "Activity"("assignedTo", "dueDate");
