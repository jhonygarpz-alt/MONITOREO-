import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncH } from '../../lib/errors';
import { requirePerm } from '../../middleware/auth';
import { parse } from '../../lib/http';
import { audit } from '../../lib/audit';
import { computeKpis, type KpiFilters } from './kpis';

export const reportsRouter = Router();

const filtersSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'custom']).default('weekly'),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(), unitId: z.string().uuid().optional(), monitoristaId: z.string().uuid().optional(),
  baseId: z.string().uuid().optional(), clientId: z.string().uuid().optional(), incidentType: z.string().optional(),
});
function resolve(q: unknown): KpiFilters {
  const p = parse(filtersSchema, q);
  const to = p.to ?? new Date();
  const days = p.period === 'daily' ? 1 : p.period === 'monthly' ? 30 : 7;
  const from = p.from ?? new Date(to.getTime() - days * 86400_000);
  return { from, to, unitId: p.unitId, monitoristaId: p.monitoristaId, baseId: p.baseId, clientId: p.clientId, incidentType: p.incidentType };
}

reportsRouter.get('/kpis', requirePerm('reports.view'), asyncH(async (req, res) => {
  const k = await computeKpis(resolve(req.query));
  const users = await prisma.user.findMany({ where: { id: { in: k.monitoristas.map((m) => m.key).filter((x) => x !== 'N/D') } }, select: { id: true, fullName: true } });
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  res.json({ ...k, monitoristas: k.monitoristas.map((m) => ({ ...m, name: names.get(m.key) ?? m.key })) });
}));

reportsRouter.get('/snapshots', requirePerm('reports.view'), asyncH(async (req, res) => {
  res.json(await prisma.kpiSnapshot.findMany({ where: req.query.period ? { period: String(req.query.period) } : {}, orderBy: { createdAt: 'desc' }, take: 60 }));
}));

function rowsFor(k: Awaited<ReturnType<typeof computeKpis>>) {
  const v = (x: number | null, suf = '') => (x === null ? 'Sin datos suficientes' : `${x}${suf}`);
  return [
    ['Cumplimiento de barridos', v(k.sweeps.compliancePct, '%')], ['Cobertura de unidades verificadas', v(k.sweeps.coveragePct, '%')],
    ['Disponibilidad de cámaras', v(k.cameras.availabilityPct, '%')], ['Disponibilidad de GPS (barridos)', v(k.gps.availabilityPct, '%')],
    ['Tiempo de detección (min)', v(k.alerts.detectionAvgMin)], ['Tiempo de primera respuesta (min)', v(k.alerts.firstResponseAvgMin)],
    ['Tiempo de escalamiento de alertas (min)', v(k.alerts.escalationAvgMin)], ['Alertas en el periodo', String(k.alerts.total)], ['Alertas vencidas', String(k.alerts.overdue)],
    ['Incidencias en el periodo', String(k.incidents.total)], ['Casos pendientes (global)', String(k.pendingCases)],
    ['Tiempo muerto operativo (min)', String(k.deadTime.totalMinutes)], ['Cumplimiento de resguardo', v(k.curfew.compliancePct, '%')],
    ['Cumplimiento de entrega de turno', v(k.handover.compliancePct, '%')], ['Asistencia a capacitación', v(k.training.attendancePct, '%')],
    ['Acuerdos cumplidos', v(k.training.agreementsMetPct, '%')],
  ];
}

reportsRouter.get('/export.xlsx', requirePerm('reports.export'), asyncH(async (req, res) => {
  const k = await computeKpis(resolve(req.query));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Centro Inteligente de Monitoreo';
  const ws = wb.addWorksheet('Indicadores');
  ws.addRow(['CENTRO INTELIGENTE DE MONITOREO — Indicadores de Gerencia']).font = { bold: true, size: 14, color: { argb: 'FF0F6B3A' } };
  ws.addRow([`Periodo: ${k.period.from.toISOString()} a ${k.period.to.toISOString()}`]);
  ws.addRow([]);
  ws.addRow(['Indicador', 'Valor']).font = { bold: true };
  rowsFor(k).forEach((r) => ws.addRow(r));
  ws.addRow([]);
  ws.addRow(['Calidad de datos']).font = { bold: true };
  (k.dataQuality.length ? k.dataQuality : ['Sin observaciones']).forEach((q) => ws.addRow([q]));
  ws.getColumn(1).width = 48; ws.getColumn(2).width = 24;
  const add = (name: string, rows: { key: string; count: number }[]) => { const s = wb.addWorksheet(name); s.addRow(['Clave', 'Cantidad']).font = { bold: true }; rows.forEach((r) => s.addRow([r.key, r.count])); s.getColumn(1).width = 40; };
  add('Incidencias por categoría', k.incidents.byCategory); add('Incidencias por unidad', k.incidents.byUnit); add('Incidencias por operador', k.incidents.byOperator); add('Alertas por tipo', k.alerts.byType);
  await audit(prisma, { action: 'report.exported_xlsx', entityType: 'Report', after: { from: k.period.from, to: k.period.to }, req });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="indicadores-${k.period.to.toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

reportsRouter.get('/export.pdf', requirePerm('reports.export'), asyncH(async (req, res) => {
  const k = await computeKpis(resolve(req.query));
  await audit(prisma, { action: 'report.exported_pdf', entityType: 'Report', after: { from: k.period.from, to: k.period.to }, req });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="indicadores-${k.period.to.toISOString().slice(0, 10)}.pdf"`);
  const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
  doc.pipe(res);
  doc.rect(0, 0, doc.page.width, 80).fill('#0F6B3A');
  doc.fillColor('#FFFFFF').fontSize(18).text('CENTRO INTELIGENTE DE MONITOREO', 48, 24).fontSize(10).text('Control Operativo y Seguridad Patrimonial — Indicadores de Gerencia');
  doc.moveDown(3).fillColor('#111827').fontSize(10).text(`Periodo: ${k.period.from.toLocaleString('es-MX')} — ${k.period.to.toLocaleString('es-MX')}`);
  doc.moveDown();
  rowsFor(k).forEach(([a, b], i) => {
    const y = doc.y;
    if (i % 2 === 0) doc.rect(48, y - 2, doc.page.width - 96, 18).fill('#F3F4F6');
    doc.fillColor('#111827').fontSize(10).text(a, 56, y, { width: 330 }).text(b, 400, y, { width: 150, align: 'right' });
    doc.moveDown(0.4);
  });
  doc.moveDown().fontSize(11).fillColor('#0F6B3A').text('Calidad de datos');
  doc.fontSize(9).fillColor('#374151');
  (k.dataQuality.length ? k.dataQuality : ['Sin observaciones']).forEach((q) => doc.text(`• ${q}`));
  doc.moveDown().fontSize(8).fillColor('#6B7280').text(`Generado ${new Date().toLocaleString('es-MX')} · Documento de uso interno`);
  doc.end();
}));
