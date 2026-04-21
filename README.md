# prisma-ms-docs

Microservicio de documentos y jobs PACI para PRISMA.

## Responsabilidad

Este servicio centraliza el flujo event-driven de documentos:

- Recibe archivos PACI en PDF o DOCX, o el JSON normalizado que proviene del formulario web.
- Recibe la planificación en PDF o DOCX.
- Sube los artefactos a S3 para disparar el trigger `PUT` que activa el Lambda.
- Guarda el historial de jobs por docente autenticado.

## Endpoints

- `POST /api/chat/start`.
- `POST /api/jobs/upload`.
- `GET /api/jobs`.
- `GET /api/jobs/:id`.
- `GET /api/jobs/:id/download`.
- `GET /api/health`.

## Variables de entorno

Ver [.env.example](/Users/javier/Documents/prisma-ms-docs/.env.example) para la lista completa.

## Arranque local

1. Instala dependencias.
2. Configura `.env` con tus credenciales.
3. Ejecuta `npm run prisma:migrate:dev`.
4. Ejecuta `npm run start:dev`.

## Notas de integración

- La autenticación se valida con Supabase usando `Authorization: Bearer <token>`.
- Los jobs se asocian al `user_id` extraído del JWT.
- Las URLs de descarga firmadas expiran en 15 minutos por defecto.
