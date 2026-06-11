## Cómo lo construiría técnicamente

La estructura base sería:

```
Frontend CRM
  - Formulario de filtros
  - Tabla de resultados
  - Botón guardar
  - Botón enriquecer
  - Botón generar research IA

Backend
  - Servicio Apollo
  - Servicio IA
  - Servicio de deduplicación
  - Servicio de créditos / logs

Base de datos
  - leads
  - companies
  - apollo_searches
  - apollo_results
  - ai_research
  - integration_logs
```

Y los endpoints propios de tu CRM podrían ser:

```
POST /crm/prospecting/search
POST /crm/prospecting/import
POST /crm/prospecting/enrich
POST /crm/prospecting/research
GET  /crm/prospecting/searches
```

Tu CRM **nunca debería llamar Apollo directo desde el navegador**. La API key debe vivir en el backend.

------

## Orden recomendado para empezar

Yo lo haría así:

```
1. API key de Apollo en backend
2. Endpoint propio para búsqueda básica
3. Pantalla de filtros en CRM
4. Importar prospectos seleccionados
5. Evitar duplicados
6. Enrichment
7. Research con IA
8. Búsquedas guardadas
9. Automatizaciones
```

La versión MVP puede ser muy simple:

```
Filtros: cargo, ubicación, industria, empleados
↓
Buscar en Apollo
↓
Mostrar 25 resultados
↓
Guardar seleccionados
↓
Generar resumen IA
```

Con eso ya tienes una primera versión útil sin meterte todavía con filtros avanzados, lookalikes ni funciones bloqueadas.

En resumen: **primero replica la búsqueda documentada por API, luego guardas/enriqueces, y recién encima montas tu propia IA**. Esa sería la ruta limpia para integrarlo bien en tu CRM.