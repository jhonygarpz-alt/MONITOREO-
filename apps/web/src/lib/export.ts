import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function nodeToPng(node: HTMLElement) {
  return toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
}
export function download(dataUrl: string, filename: string) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click();
}
export async function exportPng(node: HTMLElement, filename: string) {
  download(await nodeToPng(node), filename);
}
export async function exportPdf(node: HTMLElement, filename: string) {
  const png = await nodeToPng(node);
  const img = new Image(); img.src = png; await img.decode();
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const w = pdf.internal.pageSize.getWidth() - 72;
  const h = (img.height / img.width) * w;
  pdf.addImage(png, 'PNG', 36, 36, w, h);
  pdf.save(filename);
}
/** Comparte la imagen con la API nativa del dispositivo; si no existe, abre WhatsApp con el texto. */
export async function shareImage(node: HTMLElement, filename: string, text: string) {
  const png = await nodeToPng(node);
  const blob = await (await fetch(png)).blob();
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text }); return 'native'; }
  download(png, filename);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  return 'whatsapp';
}
