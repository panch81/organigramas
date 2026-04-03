/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from 'jspdf';
import type { ExportOptions } from '@/types/orgchart.types';

const PAGE_SIZES = {
  A4: { width: 297, height: 210 },
  A3: { width: 420, height: 297 },
};

const SCALE_MAP = {
  standard: 1.5,
  high:     2,
  print:    3,
};

export async function exportOrgChartToPdf(
  _selector: string,
  options: ExportOptions,
  fileName = 'organigrama'
): Promise<void> {
  const scale    = SCALE_MAP[options.resolution];
  const pageSize = PAGE_SIZES[options.format];

  const reactFlowEl = document.querySelector('.react-flow') as HTMLElement | null;
  if (!reactFlowEl) throw new Error('No se encontró el lienzo.');

  const nodeEls = document.querySelectorAll('.react-flow__node');
  if (nodeEls.length === 0) throw new Error('No hay nodos visibles.');

  // Ocultar paneles
  const panels = document.querySelectorAll<HTMLElement>(
    '.react-flow__controls, .react-flow__minimap, .react-flow__panel'
  );
  panels.forEach(p => { p.dataset.prevDisplay = p.style.display; p.style.display = 'none'; });

  let dataUrl: string;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dti: any = require('dom-to-image-more');

    dataUrl = await dti.toPng(reactFlowEl, {
      width:  reactFlowEl.offsetWidth  * scale,
      height: reactFlowEl.offsetHeight * scale,
      style: {
        transform:       `scale(${scale})`,
        transformOrigin: 'top left',
        background:      '#f8fafc',
      },
      filter: (node: any) => {
        const cls = (node as HTMLElement).className?.toString() ?? '';
        return (
          !cls.includes('react-flow__controls') &&
          !cls.includes('react-flow__minimap')  &&
          !cls.includes('react-flow__panel')
        );
      },
    });

  } finally {
    panels.forEach(p => { p.style.display = p.dataset.prevDisplay ?? ''; });
  }

  // Calcular dimensiones
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>(resolve => { img.onload = () => resolve(); });

  const pxToMm      = 25.4 / 96;
  const imgWidthMm  = (img.width  / scale) * pxToMm;
  const imgHeightMm = (img.height / scale) * pxToMm;

  const availW = pageSize.width  - options.marginMm * 2;
  const availH = pageSize.height - options.marginMm * 2;

  const scaledWidthMm  = availW;
  const scaledHeightMm = imgHeightMm * (availW / imgWidthMm);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit:        'mm',
    format:      options.format,
  });

  if (options.includeMetadata) {
    pdf.setProperties({
      title:   `Organigrama — ${fileName}`,
      subject: 'Exportado desde Organigrama Interactivo',
      creator: 'Organigrama Interactivo',
      author:  'HR',
    });
  }

  if (scaledHeightMm <= availH) {
    const yOffset = (availH - scaledHeightMm) / 2 + options.marginMm;
    pdf.addImage(dataUrl, 'PNG', options.marginMm, yOffset, scaledWidthMm, scaledHeightMm, undefined, 'FAST');
  } else {
    const totalPages = Math.ceil(scaledHeightMm / availH);
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();
      const yShift = options.marginMm - page * availH;
      pdf.addImage(dataUrl, 'PNG', options.marginMm, yShift, scaledWidthMm, scaledHeightMm, undefined, 'FAST');
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageSize.width, options.marginMm, 'F');
      pdf.rect(0, pageSize.height - options.marginMm, pageSize.width, options.marginMm + 2, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Página ${page + 1} de ${totalPages}`, pageSize.width - options.marginMm, pageSize.height - 3, { align: 'right' });
    }
  }

  pdf.save(`${fileName}_${options.format}.pdf`);
}
