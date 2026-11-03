# Centro Inteligente de Monitoreo
**Control Operativo y Seguridad Patrimonial** — plataforma web para el centro de monitoreo de una empresa de transporte de hidrocarburos (Nuevo Laredo → Monterrey y otras regiones de México).

Aplicación completa: base de datos PostgreSQL con migraciones e integridad a nivel BD, API con autenticación y permisos por operación, motor de reglas en servidor, bitácoras inalterables y una interfaz que separa la experiencia del **monitorista** (tareas del turno) de la de **Gerencia** (indicadores, autorizaciones y configuración).

| | |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS, TanStack Query, Leaflet |
| Backend | Node.js 22 + TypeScript + Express, Zod, JWT en cookie httpOnly |
| Datos | PostgreSQL 16 + Prisma (60 tablas, triggers y restricciones de integridad) |
| Automatización | Motor de reglas en servidor (proceso `worker`), idempotente, con reintentos |
| Pruebas | Vitest + Supertest: 26 escenarios de operación y seguridad |

## Inicio rápido (desarrollo)
```bash
npm run install:all
cp apps/api/.env.example apps/api/.env   # edite DATABASE_URL y JWT_SECRET
npm run db:migrate --prefix apps/api
SEED_DEMO=true npm run db:seed --prefix apps/api
npm run dev:api        # http://localhost:4000
npm run dev:web        # http://localhost:5173
```
Usuarios iniciales (contraseña `SEED_PASSWORD`, por defecto `Monitoreo2026!` solo en desarrollo): `monitorista1@cim.local`, `monitorista2@cim.local`, `supervisor@cim.local`, `gerencia@cim.local`, `gerencia2@cim.local`, `oe@cim.local`, `ejecutor@cim.local`, `auditor@cim.local`, `admin@cim.local`.

## Documentación
- [Arquitectura y modelo de datos](docs/ARQUITECTURA.md)
- [Instalación, variables de entorno y despliegue](docs/INSTALACION.md)
- [Manual básico de uso](docs/MANUAL.md)
- [Estado de funciones: operativas, dependientes de terceros y pendientes de datos reales](docs/ESTADO.md)
- [API](docs/API.md) — especificación OpenAPI generada en `GET /api/openapi.json`

## Principios de seguridad implementados
1. Ninguna intervención de inmovilización con el vehículo en movimiento; el sistema **no envía comandos físicos**.
2. Auditoría e historial de incidencias **inalterables** (triggers en PostgreSQL + hash encadenado).
3. Cierre de emergencias solo con pasos críticos documentados, justificación y aprobación de otra persona.
4. La pérdida de señal **no** se interpreta como robo.
5. Nunca se marca como verificado algo que no se comprobó (GPS sin posición actualizada, cámara sin ver la imagen).
6. No se solicita movimiento durante descansos, fatiga, emergencias, fallas o condiciones inseguras.
7. Comandas y datos personales filtrados en servidor según autorización.
8. No se precargan contactos, zonas de riesgo ni resultados de integraciones; los datos de demostración se etiquetan `[DEMO]`.
9. Llamadas, notificaciones y comandos no se marcan como exitosos sin confirmación.
10. Matriz de escalamiento con suplentes y respaldo automático por rol.
