-- Tipos de unidad adicionales usados por la herramienta de Optima
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'TORTON';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'RABON';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'CAMIONETA';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'PICKUP';
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'AUTOMOVIL';

-- Vínculo con sistemas externos (sincronización de solo lectura)
ALTER TABLE "units" ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "externalStatus" TEXT,
  ADD COLUMN "externalLocation" TEXT,
  ADD COLUMN "externalNotes" TEXT,
  ADD COLUMN "externalSyncedAt" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX "units_externalSource_externalId_key" ON "units"("externalSource", "externalId");
