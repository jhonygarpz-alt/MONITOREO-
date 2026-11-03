# Estado de las funciones

## Operativas (funcionan con la información que capture la empresa)
- Autenticación, bloqueo por intentos, cambio de contraseña, roles y 61 permisos por operación; menú adaptado al rol.
- Los 18 módulos con sus flujos, validaciones, auditoría y notificaciones internas.
- Barridos cada 2 h con bloqueo de concurrencia, evidencia y pendientes entre turnos.
- Control de cámaras con bitácora, flujo de falla → recuperación y disponibilidad/MTTR.
- Paradas, tiempos muertos por tipo de operación, recordatorios restringidos.
- Reglas de circulación configurables por ruta/corredor, llegadas y excepciones con doble control.
- Bandeja de alertas, incidencias con historial inalterable, protocolos interactivos, expediente, comunicaciones con folio, escalamiento con matriz y suplentes.
- Flujo de inmovilización (solicitud → 2 autorizaciones → registro de ejecución con folio → restablecimiento), **sin envío de comandos**.
- Comunicados con plantillas, aprobación, exportación PNG y compartir; comandas PNG/PDF filtradas por cliente.
- Entrega de turno con fotografía del sistema, confirmación y escalamiento a supervisión.
- Capacitación semanal automática, asistencia, casos, evaluaciones, acuerdos y vencimientos.
- Indicadores con filtros, Excel/PDF y consolidación diaria/semanal/mensual.
- Motor de reglas en servidor (13 automatizaciones) idempotente y con reintentos.
- Verificación criptográfica de la bitácora de auditoría.

## Dependen de terceros (preparadas, no simuladas)
| Función | Estado actual | Para habilitar |
|---|---|---|
| Posiciones GPS en tiempo real | Captura manual verificada (`MANUAL`) o demo (`DEMO`); el sistema lo indica en pantalla | Adaptador hacia la API del proveedor GPS que inserte en `gps_positions` con `source=INTEGRATION`; registrar y validar en *Integraciones* |
| Estado de cámaras automático | El monitorista registra lo que observa | Integración con la plataforma MDVR del proveedor |
| Comandos de inmovilización | Solo registro; `commandSentBySystem: false` | Validar fabricante, compatibilidad, procedimiento legal y seguridad; únicamente bloqueo de siguiente arranque con unidad detenida; doble autorización ya implementada |
| Envío automático de WhatsApp / correo | Se comparte desde el dispositivo (API nativa de compartir, `wa.me`, `mailto:`) y se registra el envío | WhatsApp Business API / servidor SMTP |
| Notificaciones push / SMS | Notificaciones dentro de la aplicación | Proveedor de mensajería |
| Llamadas | Botón `tel:` en dispositivos compatibles; el resultado lo registra el usuario | Conmutador/VoIP con registro de llamadas (opcional) |
| Mapas | Teselas de OpenStreetMap | Proveedor de mapas corporativo (opcional) |
| Información de tráfico | No implementado | API de tráfico |

## Necesitan datos reales o autorización
- **Directorio de emergencias**: solo se precarga el 911, marcado *sin verificar*. Cargar y verificar Guardia Nacional, autoridades estatales y municipales, Protección Civil, aseguradoras, ANRPV, proveedores GPS, Gerencia y Operaciones Estratégicas.
- **Zonas de riesgo, tramos, paradas y rutas alternas**: vacío por diseño; importar GeoJSON con fuente y validar.
- **Puntos de resguardo**: capturar y validar (el demo incluye uno de ejemplo, no operativo).
- **Reglas de circulación por corredor**: la regla inicial (22:00–06:00 para rutas foráneas más allá de Monterrey) es la política indicada por la empresa y queda sujeta a evaluación de riesgos.
- **Zona horaria de la capacitación** (Centro o Pacífico): pendiente de confirmar por Gerencia.
- **Flota, operadores, pólizas, documentos, clientes y rutas**: los datos `[DEMO]` deben depurarse (`npm run db:purge-demo`).
- **Hojas de datos de seguridad de productos**: cargar como documento del viaje (categoría *Hoja de datos de seguridad*) para que aparezcan en el expediente.
- **Aviso de privacidad y finalidades** para los datos personales de operadores: definir con el área legal.

## Escenarios probados (`apps/api/tests/scenarios.test.ts`)
Credenciales inválidas · peticiones sin sesión · permisos insuficientes · protección CSRF · dos monitoristas revisando la misma unidad · cámara funcionando sin ver la imagen · GPS sin posición · revisión con cámara sin transmisión (falla + alerta) · barrido vencido visible al siguiente turno · motor de reglas sin duplicados y pérdida de GPS ≠ robo · revisión de cámara con vehículo en movimiento · descanso obligatorio sin solicitud de movimiento · cambio de umbrales con doble control · advertencia e incumplimiento del horario de resguardo · operador que no responde (escalamiento tras 3 llamadas) · comunicación confirmada sin folio · posible robo (escalamiento, expediente, cierre bloqueado y aprobación de otra persona) · inmutabilidad de historial y auditoría · alerta crítica no descartable · inmovilización en movimiento · inmovilización sin autorización, doble firma, intento fallido no registrado como éxito, rechazo en BD · cambio de turno con incidencias abiertas y escalamiento · reportes con información incompleta · privacidad del contacto de emergencia · comanda sin datos no autorizados · verificación de contactos de emergencia.

Fallo de conexión a internet: el cliente web bloquea el envío sin conexión e informa que **la operación no se registró**; muestra una barra roja mientras dure la desconexión y solo confirma “guardado” cuando el servidor respondió con éxito.
