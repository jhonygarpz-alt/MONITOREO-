/**
 * Protocolos interactivos. Son guías de coordinación del centro de monitoreo:
 * no sustituyen los procedimientos técnicos de emergencia del producto ni las
 * indicaciones de las autoridades especializadas.
 */
export interface ProtocolStep {
  key: string; title: string; detail: string; critical?: boolean;
  /** Acción sugerida en la interfaz */
  action?: 'CALL_OPERATOR' | 'CALL_911' | 'NOTIFY' | 'ESCALATE' | 'DOSSIER' | 'IMMOB' | 'NOTE';
  channel?: string;
}
export interface Protocol { key: string; name: string; appliesTo: string[]; warning?: string; steps: ProtocolStep[] }

const lifeFirst = 'La seguridad de las personas es la prioridad absoluta. Nunca indique al operador maniobras que puedan agravar el incidente; siga las instrucciones del 911 y de las autoridades especializadas.';

export const PROTOCOLS: Protocol[] = [
  {
    key: 'VALIDACION_ALERTA', name: 'Validación y escalamiento de alerta', appliesTo: ['PERDIDA_GPS', 'POSIBLE_INTERFERENCIA', 'DESCONEXION_BATERIA', 'PARADA_SOSPECHOSA', 'DESVIACION_RUTA', 'EXCESO_VELOCIDAD', 'FALLO_CAMARAS', 'INCUMPLIMIENTO_OPERATIVO', 'TIEMPO_MUERTO'],
    warning: 'La pérdida de señal NO equivale automáticamente a robo: valide antes de concluir.',
    steps: [
      { key: 'verificar_datos', title: 'Verificar datos disponibles', detail: 'Revise última posición, antigüedad del dato, velocidad, cámaras y ruta asignada.', action: 'NOTE' },
      { key: 'llamada_1', title: 'Llamada 1 al operador', detail: 'Llame al teléfono principal. Registre el resultado real.', action: 'CALL_OPERATOR' },
      { key: 'llamada_2', title: 'Llamada 2 al operador', detail: 'Si no responde, intente nuevamente o al teléfono alterno.', action: 'CALL_OPERATOR' },
      { key: 'llamada_3', title: 'Llamada 3 al operador', detail: 'Tercer intento. Si hay indicios de emergencia grave, NO espere: escale y solicite apoyo de inmediato.', action: 'CALL_OPERATOR' },
      { key: 'escalar_gerencia', title: 'Escalar a Gerencia', detail: 'Comunique hallazgos, intentos de contacto y última posición conocida.', action: 'ESCALATE', critical: true },
      { key: 'coordinar_oe', title: 'Coordinar con Operaciones Estratégicas', detail: 'Si Gerencia lo determina o la situación lo amerita.', action: 'ESCALATE' },
      { key: 'documentar', title: 'Documentar resultado', detail: 'Registre conclusión verificada. No indique que la unidad está segura sin evidencia.', action: 'NOTE' },
    ],
  },
  {
    key: 'POSIBLE_ROBO', name: 'Posible robo', appliesTo: ['POSIBLE_ROBO'], warning: 'Si existen indicios de riesgo para el operador, active 911 sin esperar las tres llamadas.',
    steps: [
      { key: 'expediente', title: 'Abrir expediente de la unidad', detail: 'Identificación, placas, serie, fotografías, operador, carga, última ubicación, ruta, póliza y proveedor GPS.', action: 'DOSSIER', critical: true },
      { key: 'llamada_operador', title: 'Intentar contacto con el operador', detail: 'Hasta tres llamadas, salvo indicios de riesgo grave.', action: 'CALL_OPERATOR' },
      { key: 'llamada_911', title: 'Llamada de emergencia 911', detail: 'Proporcione última ubicación conocida, descripción y placas. Registre folio.', action: 'CALL_911', channel: 'EMERGENCIAS_911', critical: true },
      { key: 'guardia_nacional', title: 'Solicitud de apoyo a Guardia Nacional', detail: 'Use el contacto verificado del directorio de emergencias. Registre folio.', action: 'NOTIFY', channel: 'GUARDIA_NACIONAL', critical: true },
      { key: 'gerencia', title: 'Escalar a Gerencia y Operaciones Estratégicas', detail: 'Notificación inmediata.', action: 'ESCALATE', critical: true },
      { key: 'proveedor_gps', title: 'Notificar al proveedor GPS', detail: 'Solicite rastreo prioritario y confirmación de última posición.', action: 'NOTIFY', channel: 'PROVEEDOR_GPS' },
      { key: 'inmovilizacion', title: 'Evaluar solicitud de inmovilización', detail: 'Solo con unidad detenida y doble autorización. Nunca con el vehículo en circulación.', action: 'IMMOB' },
      { key: 'aseguradora', title: 'Reporte a la aseguradora', detail: 'Reporte de siniestro / reclamación. Registre número de reporte.', action: 'NOTIFY', channel: 'ASEGURADORA' },
      { key: 'anrpv', title: 'Reporte ANRPV', detail: 'Conforme al procedimiento vigente. Registre folio.', action: 'NOTIFY', channel: 'ANRPV' },
      { key: 'denuncia', title: 'Denuncia formal', detail: 'La denuncia formal es distinta a la llamada de emergencia; registre por separado.', action: 'NOTIFY', channel: 'AUTORIDAD_ESTATAL' },
    ],
  },
  ...(['CHOQUE', 'VOLCADURA', 'FUGA', 'DERRAME', 'INCENDIO', 'EXPOSICION'] as const).map((k): Protocol => ({
    key: `ACCIDENTE_${k}`,
    name: { CHOQUE: 'Accidente: choque', VOLCADURA: 'Accidente: volcadura', FUGA: 'Fuga de hidrocarburo', DERRAME: 'Derrame de hidrocarburo', INCENDIO: 'Incendio', EXPOSICION: 'Exposición peligrosa' }[k],
    appliesTo: k === 'FUGA' ? ['FUGA'] : k === 'DERRAME' ? ['DERRAME'] : k === 'INCENDIO' ? ['INCENDIO'] : ['ACCIDENTE', 'EMERGENCIA_OPERADOR'],
    warning: lifeFirst,
    steps: [
      { key: 'llamada_911', title: 'Activar 911 de inmediato', detail: 'Informe tipo de producto, número ONU si se conoce, ubicación y si hay lesionados.', action: 'CALL_911', channel: 'EMERGENCIAS_911', critical: true },
      { key: 'personas', title: 'Confirmar condición de personas', detail: k === 'INCENDIO' || k === 'FUGA' || k === 'EXPOSICION'
        ? 'Indique al operador alejarse a distancia segura, en dirección contraria al viento, y no regresar a la unidad.'
        : 'Pregunte por lesionados. No pida al operador mover la unidad ni manipular la carga.', critical: true, action: 'CALL_OPERATOR' },
      { key: 'info_producto', title: 'Consultar información de emergencia del producto', detail: 'Use la hoja de datos de seguridad y la guía de respuesta del producto transportado. Comparta con autoridades; no la sustituya.', action: 'DOSSIER' },
      { key: 'proteccion_civil', title: 'Notificar a Protección Civil / autoridad especializada', detail: 'Use contactos verificados. Registre folio.', action: 'NOTIFY', channel: 'PROTECCION_CIVIL', critical: true },
      { key: 'gerencia', title: 'Escalar a Gerencia y Operaciones Estratégicas', detail: 'Notificación inmediata.', action: 'ESCALATE', critical: true },
      { key: 'aseguradora', title: 'Reporte a la aseguradora', detail: 'Registre número de siniestro.', action: 'NOTIFY', channel: 'ASEGURADORA' },
      { key: 'cliente', title: 'Informar al cliente (sin datos sensibles)', detail: 'Use comanda con estado "Con incidencia" según autorización.', action: 'NOTE' },
      { key: 'documentar', title: 'Documentar cronología y evidencias', detail: 'Fotografías, folios, nombres de autoridades que atienden.', action: 'NOTE' },
    ],
  })),
];

export const protocolFor = (alertType: string) =>
  PROTOCOLS.find((p) => p.key === 'POSIBLE_ROBO' && alertType === 'POSIBLE_ROBO') ??
  PROTOCOLS.find((p) => p.appliesTo.includes(alertType)) ?? PROTOCOLS[0];

/** Tipos que se consideran indicios de emergencia grave (no esperar 3 llamadas). */
export const GRAVE_TYPES = ['POSIBLE_ROBO', 'ACCIDENTE', 'FUGA', 'DERRAME', 'INCENDIO', 'EMERGENCIA_OPERADOR'];
