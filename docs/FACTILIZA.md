# Integración Factiliza API

El sistema usa la **API de Factiliza** para rellenar automáticamente datos de personas y empresas a partir del DNI, Carnet de extranjería o RUC.

## Configuración

1. Obtén un token en [Factiliza](https://api.factiliza.com) (botón "Generar Token").
2. Añade en `backend/.env`:
   ```env
   FACTILIZA_API_TOKEN=tu_token_aqui
   ```
3. Reinicia el backend.

## Uso

### Contactos
- Tipo **DNI** o **CEE** → ingresa el número y pulsa **Enter**.
- Se cargan: nombre completo, departamento, provincia, distrito, dirección.

### Empresas
- Ingresa el **RUC** y pulsa **Enter**.
- Se cargan: razón social, nombre comercial, departamento, provincia, distrito, dirección.

## Endpoints del backend

El backend actúa como proxy (el token nunca sale del servidor):

- `GET /factiliza/dni/:dni`
- `GET /factiliza/cee/:cee`
- `GET /factiliza/ruc/:ruc`

Requieren autenticación JWT.
