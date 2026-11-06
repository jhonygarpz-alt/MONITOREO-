-- Nombres alternos del operador en sistemas externos
ALTER TABLE "operators" ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
