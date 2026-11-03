# Arquitectura

```
┌──────────────────────────┐     HTTPS (cookie httpOnly, SameSite=Strict, X-CIM-Client)
│  Web (React + Tailwind)  │ ───────────────────────────────────────────────┐
│  apps/web                │                                                │
└──────────────────────────┘                                                ▼
                                                     ┌──────────────────────────────────┐
                                                     │ API Express (apps/api/src/app.ts)│
                                                     │  • autenticación JWT + RBAC      │
                                                     │  • 22 routers por módulo         │
                                                     │  • validación Zod                │
                                                     │  • auditoría con hash encadenado │
                                                     └──────────┬───────────────────────┘
                                                                │ Prisma
┌──────────────────────────┐                                     ▼
│ Worker (src/worker.ts)   │ ─────────────►  PostgreSQL 16  ◄── triggers de integridad
│ Motor de reglas: 12 jobs │                (60 tablas, TIMESTAMPTZ, índices parciales)
└──────────────────────────┘
          ▲  futuro: adaptadores de integración GPS / cámaras / tráfico (tabla integrations)
```

## Decisiones clave
- **Monolito modular** (un servicio API + un worker) en lugar de microservicios: menor complejidad operativa para un centro de monitoreo, transacciones ACID entre módulos (p.ej. barrido → falla de cámara → alerta).
- **Express + TypeScript + Prisma**: tipado de extremo a extremo; las migraciones SQL se complementan con SQL manual para lo que el ORM no expresa (triggers, CHECK, índices parciales).
- **Integridad en la base de datos**, no solo en la API: aunque alguien acceda directamente a PostgreSQL, no puede alterar la auditoría ni autorizar una inmovilización sin dos firmas.
- **Sesión en cookie httpOnly** + encabezado `X-CIM-Client` obligatorio en métodos mutables (protección CSRF); bloqueo de cuenta tras 5 intentos; invalidación de sesiones por `tokenVersion`.
- **Fechas**: todas en `TIMESTAMPTZ` (UTC). La zona de visualización y de cálculo de horarios locales (resguardo 22:00, turnos, capacitación) es el parámetro `system.timezone` (por defecto `America/Monterrey`).

## Estructura
```
apps/api
  prisma/schema.prisma           modelo relacional
  prisma/migrations/             init + integrity_guards (triggers, CHECK, índices parciales)
  prisma/seed.ts                 catálogo de permisos/roles, parámetros, usuarios, demo opcional
  src/rbac/catalog.ts            61 permisos por operación y 7 roles base
  src/lib/audit.ts               auditoría e historial de incidencias con hash encadenado
  src/modules/*                  un router por módulo funcional
  src/engine/                    motor de reglas (jobs, runner idempotente, alertas deduplicadas)
  tests/scenarios.test.ts        escenarios de prueba
apps/web
  src/pages/*                    una página por módulo
  src/components/ui.tsx          sistema de componentes (botones, semáforos, tarjetas, modales)
```

## Módulos → implementación
| # | Módulo | API | Pantalla |
|---|---|---|---|
| 1 | Dashboard operativo | `/api/dashboard/operational`, `/monitor-home`, `/executive` | Inicio, Tablero operativo |
| 2 | Barridos cada 2 h | `/api/sweeps` | Barridos |
| 3 | Control de cámaras | `/api/cameras` | Cámaras |
| 4 | Tiempos muertos | `/api/ops` | Seguimiento operativo |
| 5 | Resguardo nocturno | `/api/route` | Resguardos |
| 6 | Mapa de riesgos | `/api/risk`, `/api/route/havens` | Zonas de riesgo |
| 7 | Alertas e incidencias | `/api/alerts`, `/api/incidents` | Alertas, Incidencias |
| 8 | Protocolos | `/api/incidents/protocols`, `protocol-step`, `communications`, `dossier` | Protocolos, detalle de incidencia |
| 9 | Inmovilización | `/api/immobilization` | Inmovilización |
| 10 | Operadores | `/api/operators` | Operadores |
| 11 | Catálogo de unidades | `/api/units` | Flota, expediente de unidad |
| 12 | Directorio de emergencias | `/api/emergency-contacts` | Directorio de emergencias |
| 13 | Comunicados | `/api/communiques` | Comunicados |
| 14 | Comandas a clientes | `/api/status` | Estatus a clientes |
| 15 | Entrega de turno | `/api/handovers`, `/api/tasks` | Entrega de turnos |
| 16 | Capacitación | `/api/training` | Capacitaciones |
| 17 | Indicadores | `/api/reports` (JSON, Excel, PDF) | Reportes |
| 18 | Administración | `/api/admin`, `/api/catalogs` | Catálogos, Usuarios, Configuración, Auditoría |

## Modelo de datos (resumen)
- **Seguridad**: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`.
- **Operación**: `bases`, `units`, `unit_couplings` (motriz ↔ remolques/tanques con vigencia), `operators`, `operator_assignments`, `clients`, `corridors`, `routes`, `trips`, `gps_devices`, `gps_positions` (con `source` MANUAL/DEMO/INTEGRATION), `cameras`, `camera_checks`, `camera_faults`, `camera_fault_actions`.
- **Barridos**: `sweep_cycles` (`cycleKey` único), `sweep_reviews` (único por ciclo+unidad, bloqueo y versión optimista).
- **Control operativo**: `stops`, `stop_follow_ups`, `operator_reminders`, `dead_time_thresholds`.
- **Ruta y riesgo**: `circulation_rules`, `safe_havens`, `haven_arrivals`, `curfew_exceptions`, `risk_features` (GeoJSON, categoría, fuente, validación).
- **Seguridad patrimonial**: `alerts` (`dedupKey` único), `incidents` (folio único), `incident_events` (inalterable), `incident_communications` (inalterable), `escalations`, `escalation_matrix`, `emergency_contacts`, `immobilization_requests`, `authorizations` (inalterable).
- **Documentos**: `documents` (hash SHA-256, nombre aleatorio, borrado lógico), `insurance_policies`.
- **Comunicación y gestión**: `communiques`, `communique_distributions`, `status_reports`, `notifications`, `tasks`, `shift_definitions`, `shift_handovers`, `training_sessions`, `training_attendance`, `training_cases`, `training_evaluations`, `agreements`.
- **Plataforma**: `settings`, `config_change_requests`, `audit_logs` (inalterable), `job_runs`, `kpi_snapshots`, `integrations`.

### Reglas de integridad en BD (`20261103190000_integrity_guards`)
- `audit_logs`, `incident_events`, `incident_communications`, `authorizations`: UPDATE/DELETE/TRUNCATE bloqueados.
- Inmovilización: estado AUTORIZADA o posterior exige ≥2 autorizaciones distintas al solicitante; ejecución exige folio del proveedor y ejecutor; modo único `BLOQUEO_SIGUIENTE_ARRANQUE`; el solicitante no puede autorizarse.
- Incidencia CERRADA exige justificación ≥20 caracteres, resultado, fecha y aprobador.
- Revisión VERIFICADA exige GPS, ubicación y cámaras verificados, responsable y hora.
- Comunicación CONFIRMADA exige folio o detalle.
- Índices únicos parciales: un remolque acoplado a una sola motriz, una asignación vigente por operador y por unidad, una parada activa por unidad, una falla abierta por cámara.

## Motor de reglas (`src/engine/jobs.ts`)
Cada ejecución tiene una clave `runKey` única en `job_runs` (protección contra duplicados entre procesos e instancias); fallos se reintentan hasta 3 veces con espera exponencial. Las alertas usan `dedupKey` único.

| Job | Automatización |
|---|---|
| `sweep.generate` | 1. Genera el ciclo de barrido vigente (periodicidad configurable) |
| `sweep.overdue` | 2. Cierra ciclos vencidos, alerta barridos vencidos e incompletos (75 % del tiempo) |
| `gps.stale` | 3. Posiciones desactualizadas / sin comunicación y excesos de velocidad |
| `cameras.alerts` | 4. Alertas de cámaras sin transmisión; escala fallas > 24 h |
| `deadtime` | 5. Tiempos muertos fuera de umbral; escala a Gerencia y Operaciones Estratégicas |
| `curfew` | 6–7. Advertencia previa al horario límite e incumplimientos de resguardo |
| `incidents.reminder` | 8. Recordatorio de incidencias sin seguimiento |
| `docs.expiry` | 9. Pólizas, documentos y licencias por vencer |
| `handover` | 10. Recordatorio de fin de turno; escala entregas no confirmadas a supervisión |
| `training.schedule` | 11. Programa las 4 próximas sesiones semanales; vence acuerdos |
| `kpi.consolidate` | 12. Consolida indicadores diarios, semanales y mensuales |
| `alerts.escalation` | 13. Escala alertas no atendidas según severidad (matriz con suplentes) |
