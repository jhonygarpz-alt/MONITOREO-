-- =====================================================================
-- Garantías de integridad a nivel base de datos (independientes de la API)
-- =====================================================================

-- 1) Bitácoras inalterables: audit_logs e incident_events no admiten UPDATE/DELETE
CREATE OR REPLACE FUNCTION cim_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registro inalterable: % sobre % no permitido', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION cim_forbid_mutation();

CREATE TRIGGER incident_events_immutable
  BEFORE UPDATE OR DELETE ON "incident_events"
  FOR EACH ROW EXECUTE FUNCTION cim_forbid_mutation();

CREATE TRIGGER incident_comms_immutable
  BEFORE UPDATE OR DELETE ON "incident_communications"
  FOR EACH ROW EXECUTE FUNCTION cim_forbid_mutation();

CREATE TRIGGER authorizations_immutable
  BEFORE UPDATE OR DELETE ON "authorizations"
  FOR EACH ROW EXECUTE FUNCTION cim_forbid_mutation();

-- TRUNCATE también bloqueado
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION cim_forbid_mutation();

-- 2) Inmovilización: nunca "ejecutada" sin confirmación del proveedor ni sin 2 autorizaciones
ALTER TABLE "immobilization_requests"
  ADD CONSTRAINT immob_execution_requires_confirmation
  CHECK ("status" NOT IN ('EJECUCION_REGISTRADA','RESTABLECIDA')
         OR ("providerConfirmation" IS NOT NULL AND length(trim("providerConfirmation")) > 0 AND "executedAt" IS NOT NULL));

ALTER TABLE "immobilization_requests"
  ADD CONSTRAINT immob_only_next_start_block
  CHECK ("mode" = 'BLOQUEO_SIGUIENTE_ARRANQUE');

CREATE OR REPLACE FUNCTION cim_immob_guard() RETURNS trigger AS $$
DECLARE approvals int;
BEGIN
  IF NEW."status" IN ('AUTORIZADA','EJECUCION_REGISTRADA','RESTABLECIDA') THEN
    SELECT count(DISTINCT "approverId") INTO approvals FROM "authorizations"
      WHERE "requestId" = NEW."id" AND "decision" = 'APROBADA' AND "approverId" <> NEW."requestedById";
    IF approvals < 2 THEN
      RAISE EXCEPTION 'Se requieren dos autorizaciones distintas al solicitante (tiene %)', approvals;
    END IF;
  END IF;
  IF NEW."status" = 'EJECUCION_REGISTRADA' AND (NEW."executorId" IS NULL) THEN
    RAISE EXCEPTION 'Debe identificarse al ejecutor autorizado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER immob_guard BEFORE UPDATE ON "immobilization_requests"
  FOR EACH ROW EXECUTE FUNCTION cim_immob_guard();

CREATE OR REPLACE FUNCTION cim_authorization_guard() RETURNS trigger AS $$
DECLARE requester uuid;
BEGIN
  SELECT "requestedById" INTO requester FROM "immobilization_requests" WHERE "id" = NEW."requestId";
  IF requester = NEW."approverId" THEN
    RAISE EXCEPTION 'El solicitante no puede autorizar su propia solicitud';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER authorization_guard BEFORE INSERT ON "authorizations"
  FOR EACH ROW EXECUTE FUNCTION cim_authorization_guard();

-- 3) Incidencias: no cerrar sin justificación, resultado y aprobación
ALTER TABLE "incidents"
  ADD CONSTRAINT incident_close_requires_justification
  CHECK ("status" <> 'CERRADA' OR (
    "closureJustification" IS NOT NULL AND length(trim("closureJustification")) >= 20
    AND "result" IS NOT NULL AND "closedAt" IS NOT NULL AND "closureApprovedById" IS NOT NULL));

-- 4) Barridos: una revisión VERIFICADA debe tener responsable, hora y evidencia de GPS verificada
ALTER TABLE "sweep_reviews"
  ADD CONSTRAINT sweep_verified_requires_evidence
  CHECK ("status" NOT IN ('VERIFICADA','CON_ANOMALIA','NO_VERIFICABLE') OR ("reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL));

ALTER TABLE "sweep_reviews"
  ADD CONSTRAINT sweep_verified_all_checked
  CHECK ("status" <> 'VERIFICADA' OR ("gpsStatus" = 'VERIFICADO' AND "locationVerified" = 'VERIFICADO' AND "camerasStatus" IN ('VERIFICADO','NO_APLICA')));

-- 5) Comunicaciones: "CONFIRMADA" exige folio o notas de confirmación
ALTER TABLE "incident_communications"
  ADD CONSTRAINT comm_confirmed_requires_evidence
  CHECK ("result" <> 'CONFIRMADA' OR ("folioObtained" IS NOT NULL OR ("notes" IS NOT NULL AND length(trim("notes")) >= 5)));

-- 6) Rangos y coherencia
ALTER TABLE "gps_positions" ADD CONSTRAINT gps_lat_range CHECK ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180);
ALTER TABLE "dead_time_thresholds" ADD CONSTRAINT dead_time_order CHECK ("warnMinutes" > 0 AND "warnMinutes" <= "maxMinutes" AND "maxMinutes" <= "escalateMinutes");
ALTER TABLE "insurance_policies" ADD CONSTRAINT policy_dates CHECK ("validTo" > "validFrom");
ALTER TABLE "curfew_exceptions" ADD CONSTRAINT curfew_exc_dates CHECK ("validUntil" > "validFrom");
ALTER TABLE "circulation_rules" ADD CONSTRAINT curfew_hhmm CHECK ("curfewStart" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "curfewEnd" ~ '^[0-2][0-9]:[0-5][0-9]$');
ALTER TABLE "unit_couplings" ADD CONSTRAINT coupling_distinct CHECK ("motorId" <> "trailerId");

-- Un remolque/tanque sólo puede estar acoplado a una motriz a la vez
CREATE UNIQUE INDEX unit_coupling_one_active_trailer ON "unit_couplings" ("trailerId") WHERE "uncoupledAt" IS NULL;
-- Un operador sólo tiene una asignación vigente y una unidad sólo un operador vigente
CREATE UNIQUE INDEX operator_assignment_one_active_op ON "operator_assignments" ("operatorId") WHERE "endAt" IS NULL;
CREATE UNIQUE INDEX operator_assignment_one_active_unit ON "operator_assignments" ("unitId") WHERE "endAt" IS NULL;
-- Una sola parada activa por unidad
CREATE UNIQUE INDEX stop_one_active_per_unit ON "stops" ("unitId") WHERE "status" = 'ACTIVA';
-- Una falla abierta por cámara
CREATE UNIQUE INDEX camera_fault_one_open ON "camera_faults" ("cameraId") WHERE "status" <> 'RECUPERADA';
