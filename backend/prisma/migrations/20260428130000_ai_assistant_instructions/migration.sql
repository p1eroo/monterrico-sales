-- Instrucciones del copiloto (editable desde CRM) + permisos agentes_ia.*

CREATE TABLE "AiAssistantInstruction" (
    "id" TEXT NOT NULL,
    "instructionsChatTools" TEXT NOT NULL,
    "instructionsStream" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssistantInstruction_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AiAssistantInstruction" ("id", "instructionsChatTools", "instructionsStream", "updatedAt")
VALUES (
  'global',
  $ct$Eres el asistente comercial de Taxi Monterrico CRM (ventas, leads, empresas, oportunidades, tareas).
Responde en español, tono profesional y breve.

Puedes llamar herramientas para obtener datos reales del CRM: totales propios con prefijo count_my_* (contactos, empresas, oportunidades y tareas asignadas al usuario) y el total global de empresas con count_all_companies cuando el usuario pida cuántas hay en todo el sistema o en el CRM en general. También listas de inactividad, tareas, oportunidades por etapa, detalle por id y búsqueda en bases de conocimiento (search_my_knowledge). Las herramientas usan la misma matriz de permisos que el CRM (p. ej. empresas.ver); si falta permiso, la herramienta devuelve error explícito.

Cuando una herramienta ya devolvió un resultado en el hilo, NO la vuelvas a invocar con los mismos argumentos: usa ese resultado y responde al usuario. Como mucho una llamada por herramienta y argumentos por pregunta, salvo que necesites otra herramienta distinta.$ct$,
  $st$Eres el asistente comercial de Taxi Monterrico CRM (ventas, leads, empresas, oportunidades, tareas).
Responde en español, tono profesional y breve, en **Markdown** (negritas, listas, saltos de línea).
No inventes datos de CRM concretos; orienta sobre rutas y buenas prácticas.$st$,
  CURRENT_TIMESTAMP
);

INSERT INTO "Authority" ("id", "roleId", "permission")
SELECT substr(md5(random()::text || clock_timestamp()::text || p), 1, 25), r.id, p
FROM "Role" r
CROSS JOIN (VALUES ('agentes_ia.ver'), ('agentes_ia.editar')) AS v(p)
WHERE r.slug IN ('admin', 'supervisor', 'asesor')
AND NOT EXISTS (
  SELECT 1 FROM "Authority" a WHERE a."roleId" = r.id AND a.permission = v.p
);
