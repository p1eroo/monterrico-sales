# Apollo Cache Backend — Plan

## Problema

Cada búsqueda en Apollo.io gasta créditos del plan Professional (4,000/mes). Si varios usuarios buscan los mismos términos desde diferentes dispositivos, cada uno gasta créditos por separado porque el frontend cachea solo en `localStorage` (por navegador).

## Objetivo

Evitar gastar créditos duplicados cuando la misma búsqueda ya fue realizada por cualquier usuario.

## Solución Propuesta

Guardar los resultados de búsqueda de Apollo en el **backend** (base de datos o Redis) con un TTL, para que cualquier usuario que busque con los mismos filtros reciba los resultados cacheados sin llamar a la API de Apollo.

## Implementación

### 1. Crear tabla/prisma schema `ApolloCache`

```prisma
model ApolloCache {
  id        String   @id @default(cuid())
  cacheKey  String   @unique
  results   Json
  total     Int      @default(0)
  credits   Int      @default(0)
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@index([cacheKey])
  @@index([expiresAt])
}
```

### 2. Modificar `apollo.service.ts`

```typescript
async searchPeople(params: { ... }) {
  const cacheKey = this.buildCacheKey('people', params);
  const cached = await this.prisma.apolloCache.findUnique({
    where: { cacheKey },
  });
  if (cached && cached.expiresAt > new Date()) {
    this.logger.log(`Apollo cache hit: ${cacheKey}`);
    return cached.results as any;
  }

  // ... llamada real a Apollo ...
  const data = await res.json();
  const result = { results, total, credits };

  // Guardar en caché por 24h
  await this.prisma.apolloCache.upsert({
    where: { cacheKey },
    update: { results: result as any, total: result.total, expiresAt: addHours(new Date(), 24) },
    create: { cacheKey, results: result as any, total: result.total, expiresAt: addHours(new Date(), 24) },
  });

  return result;
}
```

### 3. Cache key

```typescript
private buildCacheKey(type: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k] ?? ''}`).join('&');
  return `apollo:${type}:${sorted}`;
}
```

### 4. TTL (Time To Live)

- **24 horas** por defecto
- Se puede borrar manualmente si se desea forzar una búsqueda fresca

### 5. Beneficios

- Todos los usuarios comparten el mismo caché
- No se gastan créditos duplicados
- Las búsquedas cacheadas son instantáneas (sin roundtrip a Apollo)
- Fácil de implementar con Prisma + PostgreSQL (ya existente)

### 6. Próximos pasos

1. Agregar el modelo `ApolloCache` al schema de Prisma
2. Ejecutar migración
3. Modificar `searchPeople`, `searchCompanies` y `matchPeople` para usar caché
4. Considerar Redis como alternativa para mejor performance (opcional)
5. Agregar endpoint `DELETE /apollo/cache` para limpiar caché manualmente
