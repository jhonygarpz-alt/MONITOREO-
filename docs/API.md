# API

- Base: `/api`. Formato JSON. Fechas ISO-8601 en UTC.
- Autenticación: `POST /api/auth/login` crea la cookie `cim_session` (httpOnly). Alternativamente `Authorization: Bearer <token>` para integraciones de servidor.
- Toda petición mutable autenticada por cookie debe incluir `X-CIM-Client: web`.
- Especificación generada desde el código (siempre sincronizada), con el permiso requerido en `x-permissions`: **`GET /api/openapi.json`**.

## Errores
```json
{ "error": { "code": "RULE_VIOLATION", "message": "…", "details": {} } }
```
| HTTP | Código | Significado |
|---|---|---|
| 400 | `VALIDATION` / `BAD_REQUEST` | Datos inválidos |
| 401 | `UNAUTHORIZED` | Sin sesión o sesión expirada |
| 403 | `FORBIDDEN` | Sin permiso o regla de separación de funciones |
| 404 | `NOT_FOUND` | No existe |
| 409 | `CONFLICT` / `DUPLICATE` | Concurrencia (p.ej. unidad en revisión por otro monitorista) o duplicado |
| 422 | `RULE_VIOLATION` / `INTEGRITY` | Regla operativa o de seguridad (p.ej. vehículo en movimiento) |
| 500 | `INTERNAL` | Error interno: **la operación no se completó** |

## Recursos principales
| Recurso | Operaciones |
|---|---|
| `/auth` | `login`, `logout`, `me`, `change-password` |
| `/dashboard` | `operational`, `monitor-home`, `executive`, `badges` |
| `/sweeps` | `current`, `cycles`, `cycles/:id/reviews`, `reviews/:id/open`, `reviews/:id/submit`, `reviews/:id/release`, `units/:id/history`, `generate` |
| `/cameras` | listado, `faults`, `faults/:id/actions`, `availability`, `:id/history` |
| `/ops` | `stops` (alta, edición PATCH, `followups`, `reminders`, `end`), `thresholds` |
| `/route` | `curfew-status`, `rules`, `havens` (+`validate`), `arrivals` (+`depart`), `exceptions` (+`decide`) |
| `/risk` | `features` (+`validate`), `import` (GeoJSON FeatureCollection) |
| `/alerts` | alta, `ack`, `resolve`, `escalate`, `convert` |
| `/incidents` | alta, detalle, `dossier`, `communications`, `notes`, `protocol-step`, `escalate`, `status`, `reassign`, `request-closure`, `approve-closure`, `protocols` |
| `/immobilization` | alta, `authorize`, `execution`, `restore`, `cancel`, `executors` |
| `/operators` | CRUD, `assign`, `emergency-contact` (dato sensible, auditado) |
| `/units` | CRUD, `fleet`, `status`, `couple`, `devices`, `cameras`, `policies`, `positions` |
| `/emergency-contacts` | CRUD, `verify` |
| `/communiques` | alta, `templates`, `decide`, `distribute` |
| `/status` | `trips` (+`status`, `preview`, `reports`), `reports/:id/shared` |
| `/handovers`, `/tasks` | `preview`, alta, `acknowledge`, `pending-for-me`; pendientes y cierre |
| `/training` | `sessions` (+`attendance`, `cases`, `evaluations`), `agreements` (+`progress`) |
| `/reports` | `kpis`, `export.xlsx`, `export.pdf`, `snapshots` |
| `/admin` | `users`, `roles`, `permissions`, `settings`, `change-requests`, `escalation-matrix`, `shifts`, `integrations`, `audit`, `audit/verify`, `jobs` |
| `/catalogs` | `bases`, `clients`, `corridors`, `routes` |
| `/documents` | carga (multipart), listado, `download`, archivado |
