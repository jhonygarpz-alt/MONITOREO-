# Manual básico de uso

## Para el monitorista

### Al iniciar el turno
1. Inicie sesión. La pantalla **Inicio** muestra lo esencial: barrido en curso, alertas, unidades que requieren atención y pendientes del turno.
2. Si aparece el aviso “te entregó el turno”, ábralo, revise la fotografía del turno y pulse **Confirmar recepción**. Puede asumir incidencias o pendientes concretos; los demás conservan su responsable.

### Barrido de flota (cada 2 horas)
1. **Iniciar barrido** → **Revisar siguiente unidad** (las unidades sin señal, con cámaras en falla o detenidas aparecen primero).
2. **Abrir unidad**: queda reservada a su nombre (otro monitorista no puede revisarla al mismo tiempo).
3. Revise la información (posición, antigüedad del dato, operador, viaje, detención) y conteste: GPS, ubicación, movimiento, y por cada cámara su estado y si **vio la imagen**.
4. **Confirmar revisión** o **Registrar anomalía**. Lo que no pudo comprobar se registra como “no verificable” con una explicación.
   - Si la posición no está actualizada, el sistema no le permite marcar el GPS como comprobado.
   - Una cámara solo puede marcarse como funcionando si vio la imagen.
   - Las cámaras con falla abren automáticamente un seguimiento en **Cámaras**.
5. Los pendientes de ciclos anteriores aparecen en rojo en la parte superior.

### Alertas e incidencias
- **Alertas**: ordenadas por criticidad. *Atender* registra su primera respuesta; *Abrir incidencia* crea el expediente; *Escalar* notifica a Gerencia; *Cerrar* exige describir la verificación (las críticas no pueden descartarse por el monitorista).
- **Incidencia**: siga el protocolo paso a paso. *Registrar llamada* / *Registrar comunicación* guarda destinatario, número, hora, resultado real y folio. Tras 3 llamadas sin respuesta se escala automáticamente; ante emergencias graves el escalamiento es inmediato.
- **Emergencia** (botón rojo superior): elija el tipo (robo, choque/volcadura, fuga, derrame, incendio, emergencia del operador) y la unidad. Se abre el expediente y se escala a Gerencia. **Si hay riesgo para personas, llame primero al 911.**

### Seguimiento operativo
- Registre detenciones con su motivo. El semáforo indica normal / advertencia / excedido / escalar según el tipo de operación.
- *Recordatorio* para continuar solo está disponible si la detención no es por descanso, fatiga, emergencia, falla mecánica, condición insegura o inspección.

### Resguardo nocturno
- **Resguardos** muestra las unidades sujetas a la regla (rutas foráneas más allá de Monterrey: resguardadas antes de las 22:00), cuánto falta y el próximo punto de resguardo **validado**.
- *Registrar llegada* exige describir la evidencia (GPS, cámara, llamada).
- “Sin evidencia” significa que no hay posición actualizada: **no** se asume que la unidad está segura.

### Otras tareas frecuentes
- **Consultar unidad**: búsqueda superior por número económico, placas u operador.
- **Contactar operador**: *Operadores* → Llamar / WhatsApp (en teléfono abre el marcador).
- **Generar estatus**: *Estatus a clientes* → elija el viaje → *Generar comanda oficial* → PNG, PDF, WhatsApp o correo. Después registre a quién la envió.
- **Entregar turno**: *Entrega de turnos* → revise la fotografía generada → actividades prioritarias → *Entregar turno*.

## Para Gerencia
- **Inicio → Vista ejecutiva**: autorizaciones pendientes, situación actual e indicadores semanales (“Sin datos” cuando la información no alcanza).
- **Autorizaciones**: cierres de incidencias altas/críticas, inmovilizaciones (segunda firma), excepciones de circulación, comunicados normativos y cambios de configuración. Nunca puede autorizar lo que usted mismo solicitó.
- **Inmovilización**: el sistema verifica que la unidad esté detenida con posición actualizada en la solicitud, en cada autorización y en la ejecución. El ejecutor GPS registra el folio del proveedor; un intento sin confirmación queda como fallido.
- **Reportes**: filtros por periodo, unidad, monitorista, base, cliente y tipo; exportación Excel y PDF.
- **Capacitación**: las sesiones semanales (miércoles 17:00) se programan solas; registre asistencia, casos, evaluaciones y acuerdos con responsable y fecha compromiso. Confirme la zona horaria (Centro/Pacífico) en Configuración → `training.timezone` y `training.timezoneConfirmed`.
- **Configuración**: los parámetros críticos (periodicidad de barridos, umbrales, horarios de circulación, escalamiento por severidad) se cambian por solicitud y requieren autorización de otra persona; todo queda en el historial.
- **Matriz de escalamiento**: defina titular y suplente por nivel; si Gerencia no está disponible se notifica a Operaciones Estratégicas y viceversa.
- **Auditoría**: consulta filtrada y verificación criptográfica de integridad.

## Para el administrador
- **Usuarios**: alta con contraseña temporal mostrada una sola vez; los usuarios se desactivan, nunca se borran.
- **Catálogos**: bases, clientes (con permisos de visibilidad de operador y ubicación), corredores, rutas (marque “más allá de Monterrey” para la regla nocturna) y turnos.
- **Integraciones**: solo pueden habilitarse tras documentar su validación.
