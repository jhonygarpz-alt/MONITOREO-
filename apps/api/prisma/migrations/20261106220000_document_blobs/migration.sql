-- Almacenamiento de documentos dentro de PostgreSQL (opcional, STORAGE_DRIVER=database)
CREATE TABLE "document_blobs" (
    "documentId" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "document_blobs_pkey" PRIMARY KEY ("documentId")
);
ALTER TABLE "document_blobs" ADD CONSTRAINT "document_blobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Los archivos no se modifican ni se eliminan (evidencia)
CREATE TRIGGER document_blobs_immutable BEFORE UPDATE OR DELETE ON "document_blobs" FOR EACH ROW EXECUTE FUNCTION cim_forbid_mutation();
