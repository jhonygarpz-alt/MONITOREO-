import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH, badRequest, notFound } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse, uuid } from '../../lib/http';
import { audit } from '../../lib/audit';
import { env } from '../../config/env';

/** Almacenamiento seguro: nombres aleatorios fuera del webroot, hash SHA-256, lista blanca de tipos, descarga autenticada y auditada. */
export const documentsRouter = Router();
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const useDb = env.STORAGE_DRIVER === 'database';
const storageRoot = path.resolve(env.STORAGE_DIR);
if (!useDb) fs.mkdirSync(storageRoot, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.has(file.mimetype) ? cb(null, true) : cb(badRequest('Tipo de archivo no permitido (JPG, PNG, WEBP o PDF)'))),
});
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/png': (b) => b.subarray(0, 4).toString('hex') === '89504e47',
  'image/webp': (b) => b.subarray(8, 12).toString() === 'WEBP',
  'application/pdf': (b) => b.subarray(0, 4).toString() === '%PDF',
};
const ENTITY = z.enum(['Unit', 'Operator', 'Incident', 'Trip', 'InsurancePolicy', 'ShiftHandover', 'HavenArrival', 'TrainingSession']);
const CATEGORY = z.enum(['FOTOGRAFIA', 'TARJETA_CIRCULACION', 'POLIZA', 'PERMISO_SCT', 'VERIFICACION', 'EVIDENCIA', 'LICENCIA', 'HOJA_SEGURIDAD', 'OTRO']);

documentsRouter.post('/', requirePerm('documents.upload'), upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) throw badRequest('Archivo requerido');
  const b = parse(z.object({ entityType: ENTITY, entityId: uuid, category: CATEGORY, title: z.string().trim().min(2).max(200), expiresAt: z.coerce.date().optional() }), req.body);
  if (!MAGIC[req.file.mimetype]?.(req.file.buffer)) throw badRequest('El contenido del archivo no coincide con su tipo');
  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const storageKey = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}`;
  const data = { ...b, filename: path.basename(req.file.originalname).slice(0, 200), mimeType: req.file.mimetype, sizeBytes: req.file.size, sha256, storageKey, uploadedById: req.user!.id };
  if (useDb) {
    // Archivo y registro en una sola transacción: o se guardan ambos o ninguno
    const file = req.file;
    const d = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({ data });
      await tx.documentBlob.create({ data: { documentId: doc.id, data: file.buffer } });
      await audit(tx, { action: 'document.uploaded', entityType: b.entityType, entityId: b.entityId, after: { documentId: doc.id, title: b.title, sha256 }, req });
      return doc;
    });
    return res.status(201).json(d);
  }
  const full = path.join(storageRoot, storageKey);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, req.file.buffer, { mode: 0o600 });
  try {
    const d = await prisma.document.create({ data });
    await audit(prisma, { action: 'document.uploaded', entityType: b.entityType, entityId: b.entityId, after: { documentId: d.id, title: b.title, sha256 }, req });
    res.status(201).json(d);
  } catch (e) {
    fs.rmSync(full, { force: true }); // no dejar archivos huérfanos si falla el registro
    throw e;
  }
}));

documentsRouter.get('/', requirePerm('documents.view'), asyncH(async (req, res) => {
  const { entityType, entityId } = parse(z.object({ entityType: ENTITY, entityId: uuid }), req.query);
  res.json(await prisma.document.findMany({ where: { entityType, entityId, deletedAt: null }, orderBy: { uploadedAt: 'desc' } }));
}));

documentsRouter.get('/:id/download', requirePerm('documents.view'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const d = await prisma.document.findUnique({ where: { id } });
  if (!d || d.deletedAt) throw notFound('Documento');
  const headers = () => {
    res.setHeader('Content-Type', d.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.filename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
  };
  const blob = await prisma.documentBlob.findUnique({ where: { documentId: id } });
  if (blob) {
    await audit(prisma, { action: 'document.downloaded', entityType: 'Document', entityId: id, req });
    headers();
    return res.end(Buffer.from(blob.data));
  }
  const full = path.join(storageRoot, d.storageKey);
  if (!full.startsWith(storageRoot) || !fs.existsSync(full)) throw notFound('Archivo');
  await audit(prisma, { action: 'document.downloaded', entityType: 'Document', entityId: id, req });
  headers();
  fs.createReadStream(full).pipe(res);
}));

/** Borrado lógico (el archivo y su hash se conservan para auditoría) */
documentsRouter.delete('/:id', requirePerm('units.manage'), asyncH(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { reason } = parse(z.object({ reason: z.string().trim().min(5) }), req.body ?? {});
  const d = await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(prisma, { action: 'document.archived', entityType: 'Document', entityId: id, after: { reason }, req });
  res.json(d);
}));
