-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'DEMO', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('TRACTOCAMION', 'AUTOTANQUE', 'REMOLQUE', 'TANQUE', 'DOLLY');

-- CreateEnum
CREATE TYPE "UnitOpStatus" AS ENUM ('EN_TRANSITO', 'DETENIDA', 'RESGUARDADA', 'EN_PATIO', 'EN_PENSION', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO');

-- CreateEnum
CREATE TYPE "OperatorStatus" AS ENUM ('ACTIVO', 'DESCANSO', 'VACACIONES', 'INCAPACIDAD', 'BAJA');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('FUNCIONANDO', 'SIN_TRANSMISION', 'DESCONECTADA', 'OBSTRUIDA', 'IMAGEN_DEFICIENTE', 'FALLA_TECNICA', 'PENDIENTE_VALIDACION');

-- CreateEnum
CREATE TYPE "CameraFaultStatus" AS ENUM ('ABIERTA', 'OPERADOR_NOTIFICADO', 'REVISION_SOLICITADA', 'EN_SEGUIMIENTO', 'ESCALADA', 'RECUPERADA');

-- CreateEnum
CREATE TYPE "SweepCycleStatus" AS ENUM ('PROGRAMADO', 'EN_CURSO', 'COMPLETADO', 'VENCIDO', 'INCOMPLETO');

-- CreateEnum
CREATE TYPE "SweepReviewStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'VERIFICADA', 'CON_ANOMALIA', 'NO_VERIFICABLE');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('VERIFICADO', 'NO_VERIFICADO', 'CON_ANOMALIA', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "MovementState" AS ENUM ('EN_MOVIMIENTO', 'DETENIDA', 'APAGADA', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "StopReason" AS ENUM ('DESCANSO_OBLIGATORIO', 'FATIGA', 'EMERGENCIA', 'FALLA_MECANICA', 'CONDICION_INSEGURA', 'CARGA', 'DESCARGA', 'ESPERA_CLIENTE', 'TRAFICO', 'INSPECCION_AUTORIDAD', 'ALIMENTOS', 'COMBUSTIBLE', 'NO_AUTORIZADA', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('ACTIVA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('TRANSITO', 'CARGA', 'DESCARGA', 'RESGUARDO', 'PATIO', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PERDIDA_GPS', 'POSIBLE_INTERFERENCIA', 'DESCONEXION_BATERIA', 'PARADA_SOSPECHOSA', 'DESVIACION_RUTA', 'EXCESO_VELOCIDAD', 'POSIBLE_ROBO', 'ACCIDENTE', 'FUGA', 'DERRAME', 'INCENDIO', 'EMERGENCIA_OPERADOR', 'FALLO_CAMARAS', 'INCUMPLIMIENTO_OPERATIVO', 'TIEMPO_MUERTO', 'BARRIDO_VENCIDO', 'RESTRICCION_HORARIA', 'INCUMPLIMIENTO_RESGUARDO', 'DOCUMENTO_POR_VENCER', 'ENTREGA_TURNO_PENDIENTE', 'POSICION_DESACTUALIZADA');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NUEVA', 'EN_ATENCION', 'ESCALADA', 'CONVERTIDA_INCIDENCIA', 'DESCARTADA', 'RESUELTA');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('ABIERTA', 'EN_ATENCION', 'ESCALADA', 'CONTENIDA', 'PENDIENTE_CIERRE', 'CERRADA');

-- CreateEnum
CREATE TYPE "EscalationLevel" AS ENUM ('MONITORISTA', 'GERENCIA', 'OPERACIONES_ESTRATEGICAS');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('LLAMADA_OPERADOR', 'EMERGENCIAS_911', 'GUARDIA_NACIONAL', 'AUTORIDAD_ESTATAL', 'AUTORIDAD_MUNICIPAL', 'PROTECCION_CIVIL', 'ASEGURADORA', 'ANRPV', 'PROVEEDOR_GPS', 'GERENCIA', 'OPERACIONES_ESTRATEGICAS', 'CLIENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "CommType" AS ENUM ('LLAMADA_EMERGENCIA', 'DENUNCIA_FORMAL', 'RECLAMACION_SEGURO', 'SOLICITUD_APOYO', 'NOTIFICACION', 'SEGUIMIENTO');

-- CreateEnum
CREATE TYPE "CommResult" AS ENUM ('CONFIRMADA', 'SIN_RESPUESTA', 'FALLIDA', 'PENDIENTE_CONFIRMACION', 'OCUPADO');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('SIN_VERIFICAR', 'VERIFICADO', 'VENCIDO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "ImmobilizationStatus" AS ENUM ('SOLICITADA', 'PRIMERA_AUTORIZACION', 'AUTORIZADA', 'RECHAZADA', 'EJECUCION_REGISTRADA', 'RESTABLECIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AuthorizationDecision" AS ENUM ('APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'MUY_ALTO');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('RIESGO_DOCUMENTADO', 'INCIDENTE_INTERNO', 'RESTRICCION_PREVENTIVA');

-- CreateEnum
CREATE TYPE "RiskFeatureKind" AS ENUM ('TRAMO_ALTO_RIESGO', 'ZONA_INCIDENCIAS', 'PARADA_PERMITIDA', 'PARADA_RESTRINGIDA', 'RUTA_ALTERNA');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDIENTE', 'VALIDADO', 'RECHAZADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PROGRAMADO', 'EN_TRASLADO_A_CARGA', 'EN_CARGA', 'CARGADO', 'EN_TRANSITO', 'EN_RESGUARDO', 'EN_DESCARGA', 'DESCARGADO', 'FINALIZADO', 'CON_INCIDENCIA', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CommuniqueType" AS ENUM ('AVISO_PREVENTIVO', 'REGLA_SEGURIDAD', 'HORARIO_CIRCULACION', 'RECORDATORIO', 'INSTRUCCION_OPERATIVA', 'CAMPANA_SEGURIDAD', 'CAMBIO_PROCEDIMIENTO');

-- CreateEnum
CREATE TYPE "CommuniqueStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('PENDIENTE_CONFIRMACION', 'CONFIRMADA', 'CON_OBSERVACIONES', 'ESCALADA_SUPERVISION');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('ABIERTA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PROGRAMADA', 'REALIZADA', 'CANCELADA', 'REPROGRAMADA');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('ABIERTO', 'EN_PROCESO', 'CUMPLIDO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'APLICADA');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('EJECUTANDO', 'EXITOSO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('FOTOGRAFIA', 'TARJETA_CIRCULACION', 'POLIZA', 'PERMISO_SCT', 'VERIFICACION', 'EVIDENCIA', 'LICENCIA', 'HOJA_SEGURIDAD', 'OTRO');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "employeeNo" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePwd" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "shift_definitions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shift_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_handovers" (
    "id" UUID NOT NULL,
    "shiftId" UUID,
    "outgoingUserId" UUID NOT NULL,
    "incomingUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "priorities" TEXT,
    "instructions" TEXT,
    "notes" TEXT,
    "status" "HandoverStatus" NOT NULL DEFAULT 'PENDIENTE_CONFIRMACION',
    "acknowledgedAt" TIMESTAMPTZ(6),
    "receiverComments" TEXT,
    "escalatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "shift_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bases" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "economicNumber" TEXT NOT NULL,
    "plates" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "vin" TEXT,
    "type" "UnitType" NOT NULL,
    "baseId" UUID,
    "opStatus" "UnitOpStatus" NOT NULL DEFAULT 'EN_PATIO',
    "nightRuleOverride" BOOLEAN,
    "capacityLiters" INTEGER,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_couplings" (
    "id" UUID NOT NULL,
    "motorId" UUID NOT NULL,
    "trailerId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "coupledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uncoupledAt" TIMESTAMPTZ(6),

    CONSTRAINT "unit_couplings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" UUID NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phonePrimary" TEXT,
    "phoneAlt" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "status" "OperatorStatus" NOT NULL DEFAULT 'ACTIVO',
    "baseId" UUID,
    "authorizedNotes" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiresAt" TIMESTAMPTZ(6),
    "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_assignments" (
    "id" UUID NOT NULL,
    "operatorId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMPTZ(6),
    "assignedBy" UUID,

    CONSTRAINT "operator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "canSeeOperator" BOOLEAN NOT NULL DEFAULT false,
    "canSeeApproxLocation" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridors" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "corridors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "corridorId" UUID,
    "beyondMonterrey" BOOLEAN NOT NULL DEFAULT false,
    "distanceKm" INTEGER,
    "expectedHours" DOUBLE PRECISION,
    "geometry" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "tripNumber" TEXT NOT NULL,
    "clientId" UUID NOT NULL,
    "routeId" UUID,
    "unitId" UUID NOT NULL,
    "operatorId" UUID,
    "trailerIds" TEXT[],
    "product" TEXT,
    "unNumber" TEXT,
    "volumeLiters" INTEGER,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "scheduledStart" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "eta" TIMESTAMPTZ(6),
    "etaSource" TEXT,
    "finishedAt" TIMESTAMPTZ(6),
    "observations" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_devices" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "model" TEXT,
    "supportsImmobilizer" BOOLEAN NOT NULL DEFAULT false,
    "immobilizerIntegrationValidated" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMPTZ(6),

    CONSTRAINT "gps_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_positions" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedKph" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "ignition" BOOLEAN,
    "address" TEXT,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "DataSource" NOT NULL,
    "capturedBy" UUID,

    CONSTRAINT "gps_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "channel" INTEGER,
    "status" "CameraStatus" NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
    "statusAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_checks" (
    "id" UUID NOT NULL,
    "cameraId" UUID NOT NULL,
    "sweepReviewId" UUID,
    "status" "CameraStatus" NOT NULL,
    "imageViewed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "checkedById" UUID NOT NULL,
    "checkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camera_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_faults" (
    "id" UUID NOT NULL,
    "cameraId" UUID NOT NULL,
    "faultStatus" "CameraStatus" NOT NULL,
    "status" "CameraFaultStatus" NOT NULL DEFAULT 'ABIERTA',
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" UUID NOT NULL,
    "operatorNotifiedAt" TIMESTAMPTZ(6),
    "reviewRequestedAt" TIMESTAMPTZ(6),
    "vehicleStoppedConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMPTZ(6),
    "recoveredAt" TIMESTAMPTZ(6),
    "recoveryConfirmedById" UUID,

    CONSTRAINT "camera_faults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_fault_actions" (
    "id" UUID NOT NULL,
    "faultId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "actorId" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camera_fault_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sweep_cycles" (
    "id" UUID NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "status" "SweepCycleStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sweep_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sweep_reviews" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "status" "SweepReviewStatus" NOT NULL DEFAULT 'PENDIENTE',
    "lockedById" UUID,
    "lockedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "unitOpStatusSnapshot" "UnitOpStatus",
    "operatorName" TEXT,
    "lastPositionLat" DOUBLE PRECISION,
    "lastPositionLng" DOUBLE PRECISION,
    "lastPositionAt" TIMESTAMPTZ(6),
    "lastPositionSource" "DataSource",
    "locationVerified" "VerificationState" NOT NULL DEFAULT 'NO_VERIFICADO',
    "gpsStatus" "VerificationState" NOT NULL DEFAULT 'NO_VERIFICADO',
    "camerasStatus" "VerificationState" NOT NULL DEFAULT 'NO_VERIFICADO',
    "movementState" "MovementState" NOT NULL DEFAULT 'DESCONOCIDO',
    "stoppedMinutes" INTEGER,
    "stopReason" "StopReason",
    "observations" TEXT,
    "incidentsNoted" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),

    CONSTRAINT "sweep_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_time_thresholds" (
    "id" UUID NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "warnMinutes" INTEGER NOT NULL,
    "maxMinutes" INTEGER NOT NULL,
    "escalateMinutes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dead_time_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stops" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "tripId" UUID,
    "operationType" "OperationType" NOT NULL DEFAULT 'TRANSITO',
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "endedAt" TIMESTAMPTZ(6),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "locationText" TEXT,
    "reason" "StopReason" NOT NULL DEFAULT 'DESCONOCIDO',
    "authorized" BOOLEAN NOT NULL DEFAULT false,
    "status" "StopStatus" NOT NULL DEFAULT 'ACTIVA',
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" UUID,

    CONSTRAINT "stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop_follow_ups" (
    "id" UUID NOT NULL,
    "stopId" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stop_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_reminders" (
    "id" UUID NOT NULL,
    "stopId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "sentById" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circulation_rules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "corridorId" UUID,
    "routeId" UUID,
    "appliesBeyondMonterrey" BOOLEAN NOT NULL DEFAULT false,
    "curfewStart" TEXT NOT NULL,
    "curfewEnd" TEXT NOT NULL,
    "warnMinutesBefore" INTEGER NOT NULL DEFAULT 90,
    "riskAssessmentRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "circulation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safe_havens" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "municipality" TEXT,
    "highway" TEXT,
    "kmMarker" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "corridorId" UUID,
    "capacity" INTEGER,
    "hours" TEXT,
    "contactPhone" TEXT,
    "source" TEXT NOT NULL,
    "validation" "ValidationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "validatedById" UUID,
    "validatedAt" TIMESTAMPTZ(6),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "safe_havens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "haven_arrivals" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "tripId" UUID,
    "havenId" UUID NOT NULL,
    "arrivedAt" TIMESTAMPTZ(6) NOT NULL,
    "departedAt" TIMESTAMPTZ(6),
    "evidence" TEXT NOT NULL,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "haven_arrivals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curfew_exceptions" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "tripId" UUID,
    "reason" TEXT NOT NULL,
    "riskAssessment" TEXT NOT NULL,
    "validFrom" TIMESTAMPTZ(6) NOT NULL,
    "validUntil" TIMESTAMPTZ(6) NOT NULL,
    "requestedById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "curfew_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_features" (
    "id" UUID NOT NULL,
    "kind" "RiskFeatureKind" NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "highway" TEXT,
    "corridorId" UUID,
    "geometry" JSONB NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceDate" TIMESTAMPTZ(6),
    "preventiveMeasures" TEXT,
    "circulationHours" TEXT,
    "validation" "ValidationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "validatedById" UUID,
    "validatedAt" TIMESTAMPTZ(6),
    "importBatch" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'NUEVA',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unitId" UUID,
    "dedupKey" TEXT,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "detectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponseAt" TIMESTAMPTZ(6),
    "acknowledgedById" UUID,
    "escalatedAt" TIMESTAMPTZ(6),
    "resolvedAt" TIMESTAMPTZ(6),
    "resolution" TEXT,
    "incidentId" UUID,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "priority" "Severity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'ABIERTA',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unitId" UUID,
    "operatorId" UUID,
    "tripId" UUID,
    "lastKnownLat" DOUBLE PRECISION,
    "lastKnownLng" DOUBLE PRECISION,
    "lastKnownAt" TIMESTAMPTZ(6),
    "lastKnownSource" "DataSource",
    "responsibleId" UUID NOT NULL,
    "currentLevel" "EscalationLevel" NOT NULL DEFAULT 'MONITORISTA',
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponseAt" TIMESTAMPTZ(6),
    "result" TEXT,
    "closureJustification" TEXT,
    "closureRequestedById" UUID,
    "closureApprovedById" UUID,
    "closedAt" TIMESTAMPTZ(6),
    "protocolKey" TEXT,
    "protocolState" JSONB,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_events" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "incidentId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "actorId" UUID,
    "actorName" TEXT,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "incident_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_communications" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "commType" "CommType" NOT NULL,
    "contactId" UUID,
    "numberUsed" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "folioObtained" TEXT,
    "result" "CommResult" NOT NULL,
    "notes" TEXT,
    "actorId" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" UUID NOT NULL,
    "incidentId" UUID,
    "alertId" UUID,
    "fromLevel" "EscalationLevel" NOT NULL,
    "toLevel" "EscalationLevel" NOT NULL,
    "toUserId" UUID,
    "isSubstitute" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "actorId" UUID,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(6),

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_matrix" (
    "id" UUID NOT NULL,
    "level" "EscalationLevel" NOT NULL,
    "alertType" "AlertType",
    "primaryUserId" UUID NOT NULL,
    "substituteUserId" UUID,
    "ackTimeoutMinutes" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "escalation_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "category" "CommChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "altContactName" TEXT,
    "coverage" TEXT NOT NULL,
    "schedule" TEXT,
    "procedure" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'SIN_VERIFICAR',
    "verifiedAt" TIMESTAMPTZ(6),
    "verifiedById" UUID,
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immobilization_requests" (
    "id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "unitId" UUID NOT NULL,
    "incidentId" UUID,
    "reason" TEXT NOT NULL,
    "riskAssessment" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "verifiedSpeedKph" DOUBLE PRECISION,
    "verifiedPositionAt" TIMESTAMPTZ(6),
    "mode" TEXT NOT NULL DEFAULT 'BLOQUEO_SIGUIENTE_ARRANQUE',
    "status" "ImmobilizationStatus" NOT NULL DEFAULT 'SOLICITADA',
    "requestedById" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executorId" UUID,
    "executionNotes" TEXT,
    "providerConfirmation" TEXT,
    "executedAt" TIMESTAMPTZ(6),
    "restoredAt" TIMESTAMPTZ(6),
    "restorationNotes" TEXT,

    CONSTRAINT "immobilization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorizations" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" "AuthorizationDecision" NOT NULL,
    "comment" TEXT NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6),
    "uploadedById" UUID NOT NULL,
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "insurer" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "coverage" TEXT,
    "validFrom" TIMESTAMPTZ(6) NOT NULL,
    "validTo" TIMESTAMPTZ(6) NOT NULL,
    "claimsPhone" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communiques" (
    "id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "type" "CommuniqueType" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CommuniqueStatus" NOT NULL DEFAULT 'BORRADOR',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "rejectionReason" TEXT,
    "publishedAt" TIMESTAMPTZ(6),

    CONSTRAINT "communiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communique_distributions" (
    "id" UUID NOT NULL,
    "communiqueId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "sharedById" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communique_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_reports" (
    "id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "tripId" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" "TripStatus" NOT NULL,
    "observations" TEXT,
    "includeOperator" BOOLEAN NOT NULL DEFAULT false,
    "generatedById" UUID NOT NULL,
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedVia" TEXT,
    "sharedTo" TEXT,
    "sharedAt" TIMESTAMPTZ(6),

    CONSTRAINT "status_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIA',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "dedupKey" TEXT,
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Severity" NOT NULL DEFAULT 'MEDIA',
    "status" "TaskStatus" NOT NULL DEFAULT 'ABIERTA',
    "assigneeId" UUID,
    "createdById" UUID NOT NULL,
    "dueAt" TIMESTAMPTZ(6),
    "entityType" TEXT,
    "entityId" UUID,
    "originHandoverId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "completionNotes" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "timezoneConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "agenda" TEXT,
    "topics" TEXT[],
    "isDrill" BOOLEAN NOT NULL DEFAULT false,
    "drillScenario" TEXT,
    "status" "TrainingStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "facilitatorId" UUID,
    "summary" TEXT,
    "autoKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_attendance" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "present" BOOLEAN NOT NULL,
    "notes" TEXT,

    CONSTRAINT "training_attendance_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "training_cases" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "incidentId" UUID,
    "title" TEXT NOT NULL,
    "analysis" TEXT,
    "lessons" TEXT,

    CONSTRAINT "training_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "sessionId" UUID,
    "description" TEXT NOT NULL,
    "responsibleId" UUID NOT NULL,
    "dueDate" TIMESTAMPTZ(6) NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'ABIERTO',
    "progressNotes" TEXT,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_evaluations" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "notes" TEXT,

    CONSTRAINT "training_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "config_change_requests" (
    "id" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedById" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "decisionComment" TEXT,

    CONSTRAINT "config_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'EJECUTANDO',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(6),
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastSyncAt" TIMESTAMPTZ(6),
    "lastError" TEXT,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeNo_key" ON "users"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "shift_definitions_name_key" ON "shift_definitions"("name");

-- CreateIndex
CREATE INDEX "shift_handovers_status_createdAt_idx" ON "shift_handovers"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bases_code_key" ON "bases"("code");

-- CreateIndex
CREATE UNIQUE INDEX "units_economicNumber_key" ON "units"("economicNumber");

-- CreateIndex
CREATE UNIQUE INDEX "units_plates_key" ON "units"("plates");

-- CreateIndex
CREATE UNIQUE INDEX "units_vin_key" ON "units"("vin");

-- CreateIndex
CREATE INDEX "units_opStatus_idx" ON "units"("opStatus");

-- CreateIndex
CREATE INDEX "units_type_idx" ON "units"("type");

-- CreateIndex
CREATE INDEX "unit_couplings_motorId_uncoupledAt_idx" ON "unit_couplings"("motorId", "uncoupledAt");

-- CreateIndex
CREATE INDEX "unit_couplings_trailerId_uncoupledAt_idx" ON "unit_couplings"("trailerId", "uncoupledAt");

-- CreateIndex
CREATE UNIQUE INDEX "operators_employeeNo_key" ON "operators"("employeeNo");

-- CreateIndex
CREATE INDEX "operators_fullName_idx" ON "operators"("fullName");

-- CreateIndex
CREATE INDEX "operator_assignments_unitId_endAt_idx" ON "operator_assignments"("unitId", "endAt");

-- CreateIndex
CREATE INDEX "operator_assignments_operatorId_endAt_idx" ON "operator_assignments"("operatorId", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "corridors_code_key" ON "corridors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "routes_code_key" ON "routes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "trips_tripNumber_key" ON "trips"("tripNumber");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trips_unitId_status_idx" ON "trips"("unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gps_devices_provider_identifier_key" ON "gps_devices"("provider", "identifier");

-- CreateIndex
CREATE INDEX "gps_positions_unitId_recordedAt_idx" ON "gps_positions"("unitId", "recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gps_positions_unitId_recordedAt_source_key" ON "gps_positions"("unitId", "recordedAt", "source");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_unitId_label_key" ON "cameras"("unitId", "label");

-- CreateIndex
CREATE INDEX "camera_checks_cameraId_checkedAt_idx" ON "camera_checks"("cameraId", "checkedAt" DESC);

-- CreateIndex
CREATE INDEX "camera_faults_status_idx" ON "camera_faults"("status");

-- CreateIndex
CREATE INDEX "camera_faults_cameraId_openedAt_idx" ON "camera_faults"("cameraId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sweep_cycles_cycleKey_key" ON "sweep_cycles"("cycleKey");

-- CreateIndex
CREATE INDEX "sweep_cycles_status_dueAt_idx" ON "sweep_cycles"("status", "dueAt");

-- CreateIndex
CREATE INDEX "sweep_reviews_cycleId_status_idx" ON "sweep_reviews"("cycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sweep_reviews_cycleId_unitId_key" ON "sweep_reviews"("cycleId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "dead_time_thresholds_operationType_key" ON "dead_time_thresholds"("operationType");

-- CreateIndex
CREATE INDEX "stops_status_startedAt_idx" ON "stops"("status", "startedAt");

-- CreateIndex
CREATE INDEX "stops_unitId_status_idx" ON "stops"("unitId", "status");

-- CreateIndex
CREATE INDEX "haven_arrivals_unitId_arrivedAt_idx" ON "haven_arrivals"("unitId", "arrivedAt");

-- CreateIndex
CREATE INDEX "curfew_exceptions_unitId_validUntil_idx" ON "curfew_exceptions"("unitId", "validUntil");

-- CreateIndex
CREATE INDEX "risk_features_kind_validation_idx" ON "risk_features"("kind", "validation");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_dedupKey_key" ON "alerts"("dedupKey");

-- CreateIndex
CREATE INDEX "alerts_status_severity_idx" ON "alerts"("status", "severity");

-- CreateIndex
CREATE INDEX "alerts_detectedAt_idx" ON "alerts"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_folio_key" ON "incidents"("folio");

-- CreateIndex
CREATE INDEX "incidents_status_priority_idx" ON "incidents"("status", "priority");

-- CreateIndex
CREATE INDEX "incidents_openedAt_idx" ON "incidents"("openedAt");

-- CreateIndex
CREATE INDEX "incident_events_incidentId_seq_idx" ON "incident_events"("incidentId", "seq");

-- CreateIndex
CREATE INDEX "incident_communications_incidentId_at_idx" ON "incident_communications"("incidentId", "at");

-- CreateIndex
CREATE INDEX "escalations_incidentId_idx" ON "escalations"("incidentId");

-- CreateIndex
CREATE INDEX "escalation_matrix_level_alertType_idx" ON "escalation_matrix"("level", "alertType");

-- CreateIndex
CREATE INDEX "emergency_contacts_category_status_idx" ON "emergency_contacts"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "immobilization_requests_folio_key" ON "immobilization_requests"("folio");

-- CreateIndex
CREATE INDEX "immobilization_requests_status_idx" ON "immobilization_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "authorizations_requestId_approverId_key" ON "authorizations"("requestId", "approverId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE INDEX "documents_entityType_entityId_idx" ON "documents"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "documents_expiresAt_idx" ON "documents"("expiresAt");

-- CreateIndex
CREATE INDEX "insurance_policies_validTo_idx" ON "insurance_policies"("validTo");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_policies_insurer_policyNumber_unitId_key" ON "insurance_policies"("insurer", "policyNumber", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "communiques_folio_key" ON "communiques"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "status_reports_folio_key" ON "status_reports"("folio");

-- CreateIndex
CREATE INDEX "status_reports_tripId_generatedAt_idx" ON "status_reports"("tripId", "generatedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupKey_key" ON "notifications"("userId", "dedupKey");

-- CreateIndex
CREATE INDEX "tasks_status_assigneeId_idx" ON "tasks"("status", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "training_sessions_autoKey_key" ON "training_sessions"("autoKey");

-- CreateIndex
CREATE INDEX "training_sessions_scheduledAt_idx" ON "training_sessions"("scheduledAt");

-- CreateIndex
CREATE INDEX "agreements_status_dueDate_idx" ON "agreements"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "training_evaluations_sessionId_userId_key" ON "training_evaluations"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "config_change_requests_status_idx" ON "config_change_requests"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_at_idx" ON "audit_logs"("actorId", "at");

-- CreateIndex
CREATE INDEX "audit_logs_at_idx" ON "audit_logs"("at");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_runKey_key" ON "job_runs"("runKey");

-- CreateIndex
CREATE INDEX "job_runs_job_startedAt_idx" ON "job_runs"("job", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_snapshots_period_periodKey_key" ON "kpi_snapshots"("period", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_key_key" ON "integrations"("key");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shift_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_outgoingUserId_fkey" FOREIGN KEY ("outgoingUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_incomingUserId_fkey" FOREIGN KEY ("incomingUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_couplings" ADD CONSTRAINT "unit_couplings_motorId_fkey" FOREIGN KEY ("motorId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_couplings" ADD CONSTRAINT "unit_couplings_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "bases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_assignments" ADD CONSTRAINT "operator_assignments_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_devices" ADD CONSTRAINT "gps_devices_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_positions" ADD CONSTRAINT "gps_positions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_checks" ADD CONSTRAINT "camera_checks_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_checks" ADD CONSTRAINT "camera_checks_sweepReviewId_fkey" FOREIGN KEY ("sweepReviewId") REFERENCES "sweep_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_faults" ADD CONSTRAINT "camera_faults_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_fault_actions" ADD CONSTRAINT "camera_fault_actions_faultId_fkey" FOREIGN KEY ("faultId") REFERENCES "camera_faults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sweep_reviews" ADD CONSTRAINT "sweep_reviews_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "sweep_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sweep_reviews" ADD CONSTRAINT "sweep_reviews_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sweep_reviews" ADD CONSTRAINT "sweep_reviews_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sweep_reviews" ADD CONSTRAINT "sweep_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stops" ADD CONSTRAINT "stops_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_follow_ups" ADD CONSTRAINT "stop_follow_ups_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_reminders" ADD CONSTRAINT "operator_reminders_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circulation_rules" ADD CONSTRAINT "circulation_rules_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circulation_rules" ADD CONSTRAINT "circulation_rules_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safe_havens" ADD CONSTRAINT "safe_havens_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "haven_arrivals" ADD CONSTRAINT "haven_arrivals_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "haven_arrivals" ADD CONSTRAINT "haven_arrivals_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "haven_arrivals" ADD CONSTRAINT "haven_arrivals_havenId_fkey" FOREIGN KEY ("havenId") REFERENCES "safe_havens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curfew_exceptions" ADD CONSTRAINT "curfew_exceptions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curfew_exceptions" ADD CONSTRAINT "curfew_exceptions_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_features" ADD CONSTRAINT "risk_features_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES "corridors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_communications" ADD CONSTRAINT "incident_communications_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "emergency_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_matrix" ADD CONSTRAINT "escalation_matrix_primaryUserId_fkey" FOREIGN KEY ("primaryUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_matrix" ADD CONSTRAINT "escalation_matrix_substituteUserId_fkey" FOREIGN KEY ("substituteUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immobilization_requests" ADD CONSTRAINT "immobilization_requests_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immobilization_requests" ADD CONSTRAINT "immobilization_requests_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immobilization_requests" ADD CONSTRAINT "immobilization_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immobilization_requests" ADD CONSTRAINT "immobilization_requests_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "immobilization_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizations" ADD CONSTRAINT "authorizations_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communique_distributions" ADD CONSTRAINT "communique_distributions_communiqueId_fkey" FOREIGN KEY ("communiqueId") REFERENCES "communiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_reports" ADD CONSTRAINT "status_reports_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_cases" ADD CONSTRAINT "training_cases_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_evaluations" ADD CONSTRAINT "training_evaluations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
