export type Tone = 'green' | 'amber' | 'red' | 'gray' | 'blue';

const L: Record<string, string> = {
  EN_TRANSITO: 'En tránsito', DETENIDA: 'Detenida', RESGUARDADA: 'Resguardada', EN_PATIO: 'En patio', EN_PENSION: 'En pensión', MANTENIMIENTO: 'Mantenimiento', FUERA_DE_SERVICIO: 'Fuera de servicio',
  ACTUALIZADA: 'Actualizada', ATRASADA: 'Atrasada', SIN_COMUNICACION: 'Sin comunicación', NO_DISPONIBLE: 'No disponible',
  FUNCIONANDO: 'Funcionando', SIN_TRANSMISION: 'Sin transmisión', DESCONECTADA: 'Desconectada', OBSTRUIDA: 'Obstruida', IMAGEN_DEFICIENTE: 'Imagen deficiente', FALLA_TECNICA: 'Falla técnica', PENDIENTE_VALIDACION: 'Pendiente de validación',
  PENDIENTE: 'Pendiente', EN_REVISION: 'En revisión', VERIFICADA: 'Verificada', CON_ANOMALIA: 'Con anomalía', NO_VERIFICABLE: 'No verificable',
  CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja',
  NUEVA: 'Nueva', EN_ATENCION: 'En atención', ESCALADA: 'Escalada', CONVERTIDA_INCIDENCIA: 'Convertida en incidencia', DESCARTADA: 'Descartada', RESUELTA: 'Resuelta',
  ABIERTA: 'Abierta', CONTENIDA: 'Contenida', PENDIENTE_CIERRE: 'Pendiente de cierre', CERRADA: 'Cerrada',
  MONITORISTA: 'Monitorista', GERENCIA: 'Gerencia', OPERACIONES_ESTRATEGICAS: 'Operaciones Estratégicas',
  TRACTOCAMION: 'Tractocamión', AUTOTANQUE: 'Autotanque', REMOLQUE: 'Remolque', TANQUE: 'Tanque', DOLLY: 'Dolly',
  MANUAL: 'Captura manual', DEMO: 'Demostración', INTEGRATION: 'Integración',
  PROGRAMADO: 'Programado', EN_TRASLADO_A_CARGA: 'En traslado a carga', EN_CARGA: 'En carga', CARGADO: 'Cargado', EN_RESGUARDO: 'En resguardo', EN_DESCARGA: 'En descarga', DESCARGADO: 'Descargado', FINALIZADO: 'Finalizado', CON_INCIDENCIA: 'Con incidencia', CANCELADO: 'Cancelado',
  SOLICITADA: 'Solicitada', PRIMERA_AUTORIZACION: '1 de 2 autorizaciones', AUTORIZADA: 'Autorizada', RECHAZADA: 'Rechazada', EJECUCION_REGISTRADA: 'Ejecución registrada', RESTABLECIDA: 'Restablecida', CANCELADA: 'Cancelada',
  SIN_VERIFICAR: 'Sin verificar', VERIFICADO: 'Verificado', VENCIDO: 'Vencido', INACTIVO: 'Inactivo',
  VALIDADO: 'Validado', RECHAZADO: 'Rechazado',
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación', CONFIRMADA: 'Confirmada', CON_OBSERVACIONES: 'Con observaciones', ESCALADA_SUPERVISION: 'Escalada a supervisión',
  BORRADOR: 'Borrador', PENDIENTE_APROBACION: 'Pendiente de aprobación', APROBADO: 'Aprobado', PUBLICADO: 'Publicado',
  EN_TIEMPO: 'En tiempo', ADVERTENCIA: 'Próximo a horario límite', RESTRICCION_ACTIVA: 'Horario restringido', INCUMPLIMIENTO: 'Incumplimiento', EXCEPCION_AUTORIZADA: 'Excepción autorizada', SIN_EVIDENCIA: 'Sin evidencia',
  NORMAL: 'Normal', EXCEDIDO: 'Excedido', ESCALAR: 'Escalar',
  OPERADOR_NOTIFICADO: 'Operador notificado', REVISION_SOLICITADA: 'Revisión solicitada', EN_SEGUIMIENTO: 'En seguimiento', RECUPERADA: 'Recuperada',
  SIN_RESPUESTA: 'Sin respuesta', FALLIDA: 'Fallida', OCUPADO: 'Ocupado',
  PROGRAMADA: 'Programada', REALIZADA: 'Realizada', REPROGRAMADA: 'Reprogramada',
  ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', CUMPLIDO: 'Cumplido', CANCELADO_: 'Cancelado',
  APROBADA: 'Aprobada', APLICADA: 'Aplicada',
  COMPLETADO: 'Completado', EN_CURSO: 'En curso', INCOMPLETO: 'Incompleto',
};
export const label = (k?: string | null) => (k ? L[k] ?? k.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '—');

export const ALERT_TYPES: Record<string, string> = {
  PERDIDA_GPS: 'Pérdida de señal GPS', POSIBLE_INTERFERENCIA: 'Posible interferencia', DESCONEXION_BATERIA: 'Desconexión de batería', PARADA_SOSPECHOSA: 'Parada sospechosa',
  DESVIACION_RUTA: 'Desviación de ruta', EXCESO_VELOCIDAD: 'Exceso de velocidad', POSIBLE_ROBO: 'Posible robo', ACCIDENTE: 'Accidente', FUGA: 'Fuga', DERRAME: 'Derrame',
  INCENDIO: 'Incendio', EMERGENCIA_OPERADOR: 'Emergencia del operador', FALLO_CAMARAS: 'Fallo de cámaras', INCUMPLIMIENTO_OPERATIVO: 'Incumplimiento operativo',
  TIEMPO_MUERTO: 'Tiempo muerto', BARRIDO_VENCIDO: 'Barrido vencido', RESTRICCION_HORARIA: 'Restricción horaria', INCUMPLIMIENTO_RESGUARDO: 'Incumplimiento de resguardo',
  DOCUMENTO_POR_VENCER: 'Documento por vencer', ENTREGA_TURNO_PENDIENTE: 'Entrega de turno pendiente', POSICION_DESACTUALIZADA: 'Posición desactualizada',
};
export const STOP_REASONS: Record<string, string> = {
  DESCANSO_OBLIGATORIO: 'Descanso obligatorio', FATIGA: 'Fatiga', EMERGENCIA: 'Emergencia', FALLA_MECANICA: 'Falla mecánica', CONDICION_INSEGURA: 'Condición insegura',
  CARGA: 'Carga', DESCARGA: 'Descarga', ESPERA_CLIENTE: 'Espera de cliente', TRAFICO: 'Tráfico', INSPECCION_AUTORIDAD: 'Inspección de autoridad', ALIMENTOS: 'Alimentos',
  COMBUSTIBLE: 'Combustible', NO_AUTORIZADA: 'No autorizada', DESCONOCIDO: 'Desconocido',
};
export const PROTECTED_REASONS = ['DESCANSO_OBLIGATORIO', 'FATIGA', 'EMERGENCIA', 'FALLA_MECANICA', 'CONDICION_INSEGURA', 'INSPECCION_AUTORIDAD'];
export const CHANNELS: Record<string, string> = {
  LLAMADA_OPERADOR: 'Llamada al operador', EMERGENCIAS_911: '911', GUARDIA_NACIONAL: 'Guardia Nacional', AUTORIDAD_ESTATAL: 'Autoridad estatal', AUTORIDAD_MUNICIPAL: 'Autoridad municipal',
  PROTECCION_CIVIL: 'Protección Civil', ASEGURADORA: 'Aseguradora', ANRPV: 'ANRPV', PROVEEDOR_GPS: 'Proveedor GPS', GERENCIA: 'Gerencia', OPERACIONES_ESTRATEGICAS: 'Operaciones Estratégicas', CLIENTE: 'Cliente', OTRO: 'Otro',
};
export const COMM_TYPES: Record<string, string> = { LLAMADA_EMERGENCIA: 'Llamada de emergencia', DENUNCIA_FORMAL: 'Denuncia formal', RECLAMACION_SEGURO: 'Reclamación de seguro', SOLICITUD_APOYO: 'Solicitud de apoyo', NOTIFICACION: 'Notificación', SEGUIMIENTO: 'Seguimiento' };

export function tone(k?: string | null): Tone {
  if (!k) return 'gray';
  if (['CRITICA', 'SIN_COMUNICACION', 'SIN_TRANSMISION', 'DESCONECTADA', 'FALLA_TECNICA', 'INCUMPLIMIENTO', 'ESCALAR', 'VENCIDO', 'CON_INCIDENCIA', 'RECHAZADA', 'FALLIDA', 'ESCALADA_SUPERVISION', 'NUEVA'].includes(k)) return 'red';
  if (['ALTA', 'MEDIA', 'ATRASADA', 'OBSTRUIDA', 'IMAGEN_DEFICIENTE', 'PENDIENTE', 'ADVERTENCIA', 'EXCEDIDO', 'DETENIDA', 'CON_ANOMALIA', 'RESTRICCION_ACTIVA', 'SIN_EVIDENCIA', 'EN_ATENCION', 'ESCALADA', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_APROBACION', 'SIN_VERIFICAR', 'PRIMERA_AUTORIZACION', 'SOLICITADA', 'PENDIENTE_CIERRE', 'NO_VERIFICABLE', 'SIN_RESPUESTA', 'EN_REVISION', 'OPERADOR_NOTIFICADO', 'REVISION_SOLICITADA', 'EN_SEGUIMIENTO', 'MANTENIMIENTO', 'ABIERTA', 'PENDIENTE_VALIDACION'].includes(k)) return 'amber';
  if (['ACTUALIZADA', 'FUNCIONANDO', 'VERIFICADA', 'VERIFICADO', 'VALIDADO', 'CONFIRMADA', 'EN_RESGUARDO', 'RESGUARDADA', 'EN_TIEMPO', 'NORMAL', 'COMPLETADO', 'RECUPERADA', 'CERRADA', 'RESUELTA', 'AUTORIZADA', 'APROBADO', 'PUBLICADO', 'CUMPLIDO', 'EXCEPCION_AUTORIZADA', 'EN_TRANSITO', 'FINALIZADO', 'APLICADA', 'APROBADA', 'REALIZADA', 'RESTABLECIDA', 'EJECUCION_REGISTRADA'].includes(k)) return 'green';
  if (['BAJA', 'EN_CURSO', 'PROGRAMADA', 'PROGRAMADO'].includes(k)) return 'blue';
  return 'gray';
}
