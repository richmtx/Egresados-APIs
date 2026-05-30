const PDFDocument = require('pdfkit');

import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EgresadosService } from '../egresados.service';

const VINO = '#6b1232';
const GRIS = '#6B7280';
const NEGRO = '#1F2937';
const COLOR_VINO_ARG = 'FF6b1232';
const COLOR_ALT_ARG = 'FFFDF2F6';

const PAGE_MAX_Y = 550;
const MARGIN_X = 28;

@Injectable()
export class ExportEstadisticasService {
  constructor(private readonly egresadosService: EgresadosService) { }

  private fechaStr(): string {
    return new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  private filtroDesc(carrera?: string, anio?: number): string {
    const p: string[] = [];
    if (carrera) p.push(`Carrera: ${carrera}`);
    if (anio) p.push(`Año: ${anio}`);
    return p.length ? p.join('  |  ') : 'Sin filtros';
  }

  // PDF helpers

  private pdfTable(
    doc: any,
    headers: string[],
    rows: string[][],
    colWidths: number[],
    x0: number,
    y: number,
    onNewPage: () => number,
    seccionTitulo?: string,
  ): number {
    const ROW_H = 18;
    const HDR_H = 18;
    const TITULO_H = 20;
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const tituloOffset = seccionTitulo ? TITULO_H : 0;
    const MIN_ROWS_TO_SHOW = 1;
    const spaceNeeded = tituloOffset + HDR_H + (MIN_ROWS_TO_SHOW * ROW_H);

    if (y + spaceNeeded > PAGE_MAX_Y) {
      y = onNewPage();
      if (seccionTitulo) {
        y += 6;
        doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold').text(seccionTitulo, x0, y);
        y += 14;
      }
    }

    const drawHeader = (yh: number): number => {
      doc.rect(x0, yh, totalW, HDR_H).fill(VINO);
      let x = x0;
      headers.forEach((h, i) => {
        doc.fontSize(7.5).fillColor('#FFFFFF').font('Helvetica-Bold')
          .text(h, x + 3, yh + 5, { width: colWidths[i] - 6, align: 'center', lineBreak: false });
        x += colWidths[i];
      });
      return yh + HDR_H;
    };

    y = drawHeader(y);

    rows.forEach((row, ri) => {
      if (y + ROW_H > PAGE_MAX_Y) { y = onNewPage(); y = drawHeader(y); }
      if (ri % 2 === 0) doc.rect(x0, y, totalW, ROW_H).fill('#FDF2F6');
      doc.moveTo(x0, y).lineTo(x0 + totalW, y).strokeColor('#E5E7EB').lineWidth(0.4).stroke();
      let x = x0;
      row.forEach((val, ci) => {
        doc.fontSize(7).fillColor(NEGRO).font('Helvetica')
          .text(val ?? '—', x + 3, y + 5, {
            width: colWidths[ci] - 6,
            align: ci === 0 ? 'left' : 'center',
            lineBreak: false,
            ellipsis: true,
          });
        x += colWidths[ci];
      });
      y += ROW_H;
    });

    return y + 6;
  }

  private pdfNewPage(doc: any): number {
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: MARGIN_X, right: MARGIN_X } });
    return 28;
  }

  private pdfNewPageWithSubtitle(doc: any, subtitulo: string): number {
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 50, bottom: 40, left: MARGIN_X, right: MARGIN_X } });
    doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold').text('Sistema de Seguimiento de Egresados', MARGIN_X, 18);
    doc.fontSize(8).fillColor(GRIS).font('Helvetica').text(subtitulo, MARGIN_X, 30);
    return 46;
  }

  private pdfSection(doc: any, titulo: string, y: number, onNewPage?: () => number): number {
    y += 6;
    doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold').text(titulo, MARGIN_X, y);
    return y + 14;
  }

  private pdfPageHeader(doc: any, titulo: string, filtros: string, fecha: string): number {
    doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold').text('Sistema de Seguimiento de Egresados', MARGIN_X, 18);
    doc.fontSize(15).fillColor(NEGRO).font('Helvetica-Bold').text(titulo, MARGIN_X, 32);
    doc.fontSize(7.5).fillColor(GRIS).font('Helvetica').text(`Filtros: ${filtros}   |   Generado: ${fecha}`, MARGIN_X, 52);
    return 68;
  }

  private pdfFooter(doc: any, fecha: string): void {
    doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica')
      .text(`Generado el ${fecha}`, MARGIN_X, 570, { continued: true })
      .text('Sistema de Seguimiento de Egresados — ITD', { align: 'right' });
  }

  private pdfDoc(): any {
    return new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 50, bottom: 40, left: MARGIN_X, right: MARGIN_X } });
  }

  private collectBuffer(doc: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  // Excel helpers

  private excelHeader(ws: ExcelJS.Worksheet, title: string, filtros: string, numCols: number, fecha: string): void {
    const lastCol = String.fromCharCode(64 + numCols);
    ws.mergeCells(`A1:${lastCol}1`); const t = ws.getCell('A1'); t.value = title; t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VINO_ARG } }; t.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(1).height = 28;
    ws.mergeCells(`A2:${lastCol}2`); const f = ws.getCell('A2'); f.value = `Filtros: ${filtros}`; f.font = { italic: true, size: 8.5, color: { argb: 'FF6B7280' } }; f.alignment = { horizontal: 'left', vertical: 'middle' }; ws.getRow(2).height = 16;
    ws.mergeCells(`A3:${lastCol}3`); const i = ws.getCell('A3'); i.value = `Generado: ${fecha}`; i.font = { size: 8, color: { argb: 'FF9CA3AF' } }; i.alignment = { horizontal: 'left', vertical: 'middle' }; ws.getRow(3).height = 14;
  }

  private excelTable(ws: ExcelJS.Worksheet, headers: string[], rows: (string | number | null)[][], startRow: number): number {
    const headerRow = ws.getRow(startRow);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h; cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VINO_ARG } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
    });
    headerRow.height = 22;
    rows.forEach((row, ri) => {
      const dataRow = ws.addRow(row);
      const bg = ri % 2 === 0 ? COLOR_ALT_ARG : 'FFFFFFFF';
      dataRow.eachCell({ includeEmpty: true }, (cell, ci) => {
        if (ci <= headers.length) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { size: 9 }; cell.alignment = { vertical: 'middle' };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
        }
      });
      dataRow.height = 18;
    });
    const lastCol = String.fromCharCode(64 + headers.length);
    ws.autoFilter = { from: `A${startRow}`, to: `${lastCol}${startRow}` };
    return startRow + 1 + rows.length;
  }

  private makeWorkbook(titulo: string, filtros: string, fecha: string, _numCols: (name: string) => number) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema de Seguimiento de Egresados';
    wb.created = new Date();
    const addSheet = (name: string, cols: number, title: string) => {
      const ws = wb.addWorksheet(name, { pageSetup: { orientation: 'landscape', fitToPage: true }, views: [{ state: 'frozen', ySplit: 4 }] });
      this.excelHeader(ws, title, filtros, cols, fecha);
      return ws;
    };
    return { wb, addSheet };
  }

  private async toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }

  // PÁGINA 1 — Estadísticas Generales

  async exportarEstadisticasPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc(); const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPage(doc);
    const k = data.kpis;

    let y = this.pdfPageHeader(doc, 'Estadísticas Generales', filtros, fecha);

    y = this.pdfSection(doc, 'Indicadores Clave', y, onNewPage);
    y = this.pdfTable(doc, ['Indicador', 'Valor'], [
      ['Total Egresados', String(k.total_egresados)], ['Empleados', String(k.empleados)],
      ['Desempleados', String(k.desempleados)], ['Titulados', String(k.titulados)],
      ['En Trámite', String(k.en_tramite)], ['No Titulados', String(k.no_titulados)],
      ['Satisfacción Prom.', `${(+(k.satisfaccion_promedio) || 0).toFixed(2)} / 5`],
      ['Autorizó Contacto', String(k.autorizo_contacto)], ['Autorizó Eventos', String(k.autorizo_eventos)],
    ], [280, 160], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Situación Laboral', y, onNewPage);
    y = this.pdfTable(doc, ['Situación', 'Total'],
      (data.situacionLaboral || []).map((r: any) => [r.situacion, String(r.total)]),
      [360, 100], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Empleo por Carrera', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Total', 'Empleados', '% Emp.'],
      (data.empleabilidadCarrera || []).map((r: any) => [
        r.nombre_carrera, String(r.total), String(r.empleados),
        r.total > 0 ? `${((r.empleados / r.total) * 100).toFixed(1)}%` : '0%',
      ]),
      [240, 80, 90, 90], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Estado de Titulación', y, onNewPage);
    y = this.pdfTable(doc, ['Estado', 'Total', '%'], [
      ['Titulados', String(k.titulados), `${((k.titulados / (k.total_egresados || 1)) * 100).toFixed(1)}%`],
      ['En Trámite', String(k.en_tramite), `${((k.en_tramite / (k.total_egresados || 1)) * 100).toFixed(1)}%`],
      ['No Titulados', String(k.no_titulados), `${((k.no_titulados / (k.total_egresados || 1)) * 100).toFixed(1)}%`],
    ], [240, 100, 100], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Titulación por Año', y, onNewPage);
    y = this.pdfTable(doc, ['Año', 'Total', 'Titulados', 'En Trámite', '% Tit.'],
      (data.titulacionAnio || []).map((r: any) => [
        String(r.anio_egreso), String(r.total), String(r.titulados),
        String(r.en_tramite), `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
      ]),
      [80, 80, 100, 110, 100], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Niveles de Inglés', y, onNewPage);
    y = this.pdfTable(doc, ['Nivel', 'Total'],
      (data.nivelesIngles || []).map((r: any) => [r.nivel, String(r.total)]),
      [300, 100], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Inglés por Carrera', y, onNewPage);
    const inglesMap = new Map<string, Record<string, number>>();
    (data.inglesCarrera || []).forEach((r: any) => {
      if (!inglesMap.has(r.nombre_carrera)) inglesMap.set(r.nombre_carrera, {});
      inglesMap.get(r.nombre_carrera)![r.nivel] = +(r.total);
    });
    const inglesRows = Array.from(inglesMap.entries()).map(([c, n]) => [
      c, String(n['Básico (A1-A2)'] ?? 0), String(n['Intermedio (B1-B2)'] ?? 0), String(n['Avanzado (C1-C2)'] ?? 0),
    ]);
    y = this.pdfTable(doc, ['Carrera', 'Básico', 'Intermedio', 'Avanzado'],
      inglesRows, [260, 90, 100, 100], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Satisfacción Académica', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Promedio (/ 5)'],
      (data.satisfaccionCarrera || [])
        .sort((a: any, b: any) => +b.promedio - +a.promedio)
        .map((r: any) => [r.nombre_carrera, (+(r.promedio) || 0).toFixed(2)]),
      [360, 140], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Sector Laboral', y, onNewPage);
    y = this.pdfTable(doc, ['Sector', 'Total'],
      (data.sectorLaboral || []).map((r: any) => [r.sector || '—', String(r.total)]),
      [370, 100], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Top Empresas', y, onNewPage);
    y = this.pdfTable(doc, ['Empresa', 'Total'],
      (data.topEmpresas || []).map((r: any) => [r.empresa || '—', String(r.total)]),
      [370, 100], MARGIN_X, y, onNewPage);

    y = this.pdfSection(doc, 'Autorizaciones por Carrera', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Autorizó Contacto', 'Autorizó Eventos', 'Total'],
      (data.participacionCarrera || []).map((r: any) => [
        r.nombre_carrera, String(r.autorizo_contacto), String(r.autorizo_eventos), String(r.total),
      ]),
      [230, 120, 120, 80], MARGIN_X, y, onNewPage);

    if ((data.fueraDurango || []).length > 0) {
      y = this.pdfSection(doc, 'Egresados Fuera de Durango', y, onNewPage);
      const mapaFD = new Map<string, number>();
      (data.fueraDurango || []).forEach((r: any) => mapaFD.set(r.ciudad_trabajo, (mapaFD.get(r.ciudad_trabajo) || 0) + +(r.total)));
      y = this.pdfTable(doc, ['Ciudad de Trabajo', 'Total'],
        [...mapaFD.entries()].sort((a, b) => b[1] - a[1]).map(([c, t]) => [c, String(t)]),
        [370, 100], MARGIN_X, y, onNewPage);
    }

    if ((data.fueraMexico || []).length > 0) {
      y = this.pdfSection(doc, 'Egresados Fuera de México', y, onNewPage);
      const mapaFM = new Map<string, number>();
      (data.fueraMexico || []).forEach((r: any) => mapaFM.set(r.ciudad_trabajo, (mapaFM.get(r.ciudad_trabajo) || 0) + +(r.total)));
      y = this.pdfTable(doc, ['Ciudad / País', 'Total'],
        [...mapaFM.entries()].sort((a, b) => b[1] - a[1]).map(([c, t]) => [c, String(t)]),
        [370, 100], MARGIN_X, y, onNewPage);
    }

    // Hallazgos Destacados
    const insights: { emoji: string; titulo: string; descripcion: string }[] = [];
    const total = k.total_egresados || 1;

    // Carrera más empleable
    const empCarrera = (data.empleabilidadCarrera || []);
    if (empCarrera.length > 0) {
      const masEmpleable = empCarrera.reduce(
        (prev: any, curr: any) => (+curr.empleados / +curr.total) > (+prev.empleados / +prev.total) ? curr : prev,
        empCarrera[0],
      );
      if (masEmpleable) {
        const pct = ((+masEmpleable.empleados / +masEmpleable.total) * 100).toFixed(1);
        const nombre = masEmpleable.nombre_carrera
          .replace('Ingeniería ', 'Ing. ')
          .replace('Sistemas Computacionales (Presencial / Virtual)', 'Sistemas Comp.');
        insights.push({
          emoji: '🏆',
          titulo: 'Carrera más empleable',
          descripcion: `${nombre} tiene la tasa más alta de empleo: ${pct}% de sus egresados trabajan actualmente.`,
        });
      }
    }

    // Tasa de titulación
    const pctTit = ((+k.titulados / total) * 100).toFixed(1);
    insights.push({
      emoji: '📜',
      titulo: 'Tasa de titulación',
      descripcion: `El ${pctTit}% de los egresados ya están titulados. ${k.en_tramite} tienen el proceso en trámite actualmente.`,
    });

    // Nivel de inglés dominante
    const nivelesIngles = (data.nivelesIngles || []);
    if (nivelesIngles.length > 0) {
      const dominante = nivelesIngles.reduce(
        (a: any, b: any) => +b.total > +a.total ? b : a,
        nivelesIngles[0],
      );
      const pctIng = ((+dominante.total / total) * 100).toFixed(1);
      insights.push({
        emoji: '🌐',
        titulo: 'Nivel de inglés dominante',
        descripcion: `El ${pctIng}% de los egresados tienen nivel ${dominante.nivel}. Considerar programas de mejora del idioma.`,
      });
    }

    // Alta satisfacción académica
    if (+(k.satisfaccion_promedio) >= 4) {
      insights.push({
        emoji: '⭐',
        titulo: 'Alta satisfacción académica',
        descripcion: `La satisfacción promedio es ${(+(k.satisfaccion_promedio)).toFixed(2)}/5, lo que indica una percepción positiva de la formación recibida.`,
      });
    }

    // Egresados en el extranjero
    const totalExt = (data.fueraMexico || []).reduce((s: number, f: any) => s + +f.total, 0);
    if (totalExt > 0) {
      insights.push({
        emoji: '✈️',
        titulo: 'Egresados en el extranjero',
        descripcion: `${totalExt} egresado${totalExt > 1 ? 's' : ''} trabaja${totalExt === 1 ? '' : 'n'} fuera de México, presencia internacional del ITD.`,
      });
    }

    // Movilidad nacional
    const totalFD = (data.fueraDurango || []).reduce((s: number, f: any) => s + +f.total, 0);
    if (totalFD > 0) {
      insights.push({
        emoji: '📍',
        titulo: 'Movilidad nacional',
        descripcion: `${totalFD} egresado${totalFD > 1 ? 's' : ''} trabaja${totalFD === 1 ? '' : 'n'} en otras ciudades de México fuera de Durango.`,
      });
    }

    // Dibujar sección de hallazgos si hay datos
    if (insights.length > 0) {
      // Título de sección
      y += 8;
      if (y + 14 + insights.length * 40 > PAGE_MAX_Y) y = onNewPage();
      doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold').text('Hallazgos Destacados', MARGIN_X, y);
      y += 14;

      insights.forEach((insight) => {
        if (y + 38 > PAGE_MAX_Y) y = onNewPage();

        const BLOCK_W = 780;
        const BLOCK_H = 34;
        doc.rect(MARGIN_X, y, BLOCK_W, BLOCK_H).fill('#FDF2F6');
        doc.moveTo(MARGIN_X, y).lineTo(MARGIN_X + BLOCK_W, y).strokeColor('#E5E7EB').lineWidth(0.4).stroke();

        // Franja de color vino a la izquierda
        doc.rect(MARGIN_X, y, 4, BLOCK_H).fill(VINO);

        // Título en vino
        doc.fontSize(8).fillColor(VINO).font('Helvetica-Bold')
          .text(insight.titulo, MARGIN_X + 12, y + 6, { width: 200, lineBreak: false });

        // Descripción en gris oscuro
        doc.fontSize(7).fillColor('#374151').font('Helvetica')
          .text(insight.descripcion, MARGIN_X + 12, y + 18, { width: 755, lineBreak: false, ellipsis: true });

        y += BLOCK_H + 3;
      });

      y += 4;
    }

    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarEstadisticasExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const wb = new ExcelJS.Workbook(); wb.creator = 'Sistema de Seguimiento de Egresados'; wb.created = new Date();
    const k = data.kpis;

    const addSheet = (name: string, cols: number, title: string): ExcelJS.Worksheet => {
      const ws = wb.addWorksheet(name, { pageSetup: { orientation: 'landscape', fitToPage: true }, views: [{ state: 'frozen', ySplit: 4 }] });
      this.excelHeader(ws, title, filtros, cols, fecha);
      return ws;
    };

    { const ws = addSheet('KPIs', 2, 'Estadísticas Generales — KPIs'); ws.columns = [{ key: 'ind', width: 30 }, { key: 'val', width: 20 }]; this.excelTable(ws, ['Indicador', 'Valor'], [['Total Egresados', k.total_egresados], ['Empleados', k.empleados], ['Desempleados', k.desempleados], ['Titulados', k.titulados], ['En Trámite', k.en_tramite], ['No Titulados', k.no_titulados], ['Satisfacción Prom.', k.satisfaccion_promedio], ['Autorizó Contacto', k.autorizo_contacto], ['Autorizó Eventos', k.autorizo_eventos]], 4); }
    { const ws = addSheet('Situación Laboral', 2, 'Situación Laboral'); ws.columns = [{ key: 'sit', width: 38 }, { key: 'tot', width: 15 }]; this.excelTable(ws, ['Situación', 'Total'], (data.situacionLaboral || []).map((r: any) => [r.situacion, r.total]), 4); }
    { const ws = addSheet('Empleo Carrera', 4, 'Empleo por Carrera'); ws.columns = [{ key: 'c', width: 38 }, { key: 't', width: 12 }, { key: 'e', width: 14 }, { key: 'p', width: 16 }]; this.excelTable(ws, ['Carrera', 'Total', 'Empleados', '% Empleados'], (data.empleabilidadCarrera || []).map((r: any) => [r.nombre_carrera, r.total, r.empleados, r.total > 0 ? +((r.empleados / r.total) * 100).toFixed(2) : 0]), 4); }
    { const ws = addSheet('Estado Titulación', 3, 'Estado de Titulación'); ws.columns = [{ key: 'est', width: 22 }, { key: 'tot', width: 14 }, { key: 'pct', width: 14 }]; const total = k.total_egresados || 1; this.excelTable(ws, ['Estado', 'Total', '%'], [['Titulados', k.titulados, +((k.titulados / total) * 100).toFixed(2)], ['En Trámite', k.en_tramite, +((k.en_tramite / total) * 100).toFixed(2)], ['No Titulados', k.no_titulados, +((k.no_titulados / total) * 100).toFixed(2)]], 4); }
    { const ws = addSheet('Titulación Año', 5, 'Titulación por Año de Egreso'); ws.columns = [{ key: 'a', width: 12 }, { key: 't', width: 12 }, { key: 'tt', width: 14 }, { key: 'tr', width: 14 }, { key: 'p', width: 16 }]; this.excelTable(ws, ['Año', 'Total', 'Titulados', 'En Trámite', '% Titulados'], (data.titulacionAnio || []).map((r: any) => [r.anio_egreso, r.total, r.titulados, r.en_tramite, r.pct_titulados]), 4); }
    { const ws = addSheet('Nivel Inglés', 2, 'Distribución de Niveles de Inglés'); ws.columns = [{ key: 'n', width: 28 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Nivel', 'Total'], (data.nivelesIngles || []).map((r: any) => [r.nivel, r.total]), 4); }
    { const ws = addSheet('Inglés Carrera', 4, 'Inglés por Carrera'); ws.columns = [{ key: 'c', width: 38 }, { key: 'b', width: 16 }, { key: 'i', width: 16 }, { key: 'a', width: 16 }]; const ingMap = new Map<string, Record<string, number>>(); (data.inglesCarrera || []).forEach((r: any) => { if (!ingMap.has(r.nombre_carrera)) ingMap.set(r.nombre_carrera, {}); ingMap.get(r.nombre_carrera)![r.nivel] = +(r.total); }); const ingRows = Array.from(ingMap.entries()).map(([c, n]) => [c, n['Básico (A1-A2)'] ?? 0, n['Intermedio (B1-B2)'] ?? 0, n['Avanzado (C1-C2)'] ?? 0]); this.excelTable(ws, ['Carrera', 'Básico (A1-A2)', 'Intermedio (B1-B2)', 'Avanzado (C1-C2)'], ingRows, 4); }
    { const ws = addSheet('Satisfacción', 2, 'Satisfacción Académica por Carrera'); ws.columns = [{ key: 'c', width: 38 }, { key: 'p', width: 22 }]; const sorted = [...(data.satisfaccionCarrera || [])].sort((a: any, b: any) => +b.promedio - +a.promedio); this.excelTable(ws, ['Carrera', 'Promedio (sobre 5)'], sorted.map((r: any) => [r.nombre_carrera, r.promedio]), 4); }
    { const ws = addSheet('Sector Laboral', 2, 'Sector Laboral'); ws.columns = [{ key: 's', width: 38 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Sector', 'Total'], (data.sectorLaboral || []).map((r: any) => [r.sector, r.total]), 4); }
    { const ws = addSheet('Top Empresas', 2, 'Top Empresas'); ws.columns = [{ key: 'e', width: 38 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Empresa', 'Total'], (data.topEmpresas || []).map((r: any) => [r.empresa || '—', r.total]), 4); }
    { const ws = addSheet('Autorizaciones', 4, 'Autorizaciones por Carrera'); ws.columns = [{ key: 'c', width: 38 }, { key: 'co', width: 18 }, { key: 'ev', width: 18 }, { key: 't', width: 12 }]; this.excelTable(ws, ['Carrera', 'Autorizó Contacto', 'Autorizó Eventos', 'Total'], (data.participacionCarrera || []).map((r: any) => [r.nombre_carrera, r.autorizo_contacto, r.autorizo_eventos, r.total]), 4); }
    if ((data.fueraDurango || []).length > 0) { const ws = addSheet('Fuera de Durango', 3, 'Egresados Fuera de Durango'); ws.columns = [{ key: 'ci', width: 32 }, { key: 'ca', width: 38 }, { key: 't', width: 12 }]; this.excelTable(ws, ['Ciudad', 'Carrera', 'Total'], (data.fueraDurango || []).map((r: any) => [r.ciudad_trabajo, r.nombre_carrera, r.total]), 4); }
    if ((data.fueraMexico || []).length > 0) { const ws = addSheet('Fuera de México', 3, 'Egresados Fuera de México'); ws.columns = [{ key: 'ci', width: 32 }, { key: 'ca', width: 38 }, { key: 't', width: 12 }]; this.excelTable(ws, ['Ciudad / País', 'Carrera', 'Total'], (data.fueraMexico || []).map((r: any) => [r.ciudad_trabajo, r.nombre_carrera, r.total]), 4); }
    { const ws = addSheet('Evolución', 5, 'Evolución por Generación'); ws.columns = [{ key: 'a', width: 12 }, { key: 't', width: 12 }, { key: 'pe', width: 16 }, { key: 'pt', width: 16 }, { key: 's', width: 18 }]; this.excelTable(ws, ['Año', 'Total', '% Empleados', '% Titulados', 'Satisfacción %'], (data.evolucionGeneracion || []).map((r: any) => [r.anio_egreso, r.total, r.pct_empleados, r.pct_titulados, r.satisfaccion_pct]), 4); }

    // Hallazgos Destacados
    {
      const ws = addSheet('Hallazgos', 2, 'Hallazgos Destacados');
      ws.columns = [{ key: 'titulo', width: 35 }, { key: 'descripcion', width: 90 }];

      const total = k.total_egresados || 1;
      const insights: (string | number | null)[][] = [];

      // Carrera más empleable
      const empCarrera = (data.empleabilidadCarrera || []);
      if (empCarrera.length > 0) {
        const masEmpleable = empCarrera.reduce(
          (prev: any, curr: any) => (+curr.empleados / +curr.total) > (+prev.empleados / +prev.total) ? curr : prev,
          empCarrera[0],
        );
        if (masEmpleable) {
          const pct = ((+masEmpleable.empleados / +masEmpleable.total) * 100).toFixed(1);
          const nombre = masEmpleable.nombre_carrera
            .replace('Ingeniería ', 'Ing. ')
            .replace('Sistemas Computacionales (Presencial / Virtual)', 'Sistemas Comp.');
          insights.push(['Carrera más empleable', `${nombre} tiene la tasa más alta de empleo: ${pct}% de sus egresados trabajan actualmente.`]);
        }
      }

      // Tasa de titulación
      const pctTit = ((+k.titulados / total) * 100).toFixed(1);
      insights.push(['Tasa de titulación', `El ${pctTit}% de los egresados ya están titulados. ${k.en_tramite} tienen el proceso en trámite actualmente.`]);

      // Nivel de inglés dominante
      const nivelesIngles = (data.nivelesIngles || []);
      if (nivelesIngles.length > 0) {
        const dominante = nivelesIngles.reduce((a: any, b: any) => +b.total > +a.total ? b : a, nivelesIngles[0]);
        const pctIng = ((+dominante.total / total) * 100).toFixed(1);
        insights.push(['Nivel de inglés dominante', `El ${pctIng}% de los egresados tienen nivel ${dominante.nivel}. Considerar programas de mejora del idioma.`]);
      }

      // Alta satisfacción académica
      if (+(k.satisfaccion_promedio) >= 4) {
        insights.push(['Alta satisfacción académica', `La satisfacción promedio es ${(+(k.satisfaccion_promedio)).toFixed(2)}/5, lo que indica una percepción positiva de la formación recibida.`]);
      }

      // Egresados en el extranjero
      const totalExt = (data.fueraMexico || []).reduce((s: number, f: any) => s + +f.total, 0);
      if (totalExt > 0) {
        insights.push(['Egresados en el extranjero', `${totalExt} egresado${totalExt > 1 ? 's' : ''} trabaja${totalExt === 1 ? '' : 'n'} fuera de México, presencia internacional del ITD.`]);
      }

      // Movilidad nacional
      const totalFD = (data.fueraDurango || []).reduce((s: number, f: any) => s + +f.total, 0);
      if (totalFD > 0) {
        insights.push(['Movilidad nacional', `${totalFD} egresado${totalFD > 1 ? 's' : ''} trabaja${totalFD === 1 ? '' : 'n'} en otras ciudades de México fuera de Durango.`]);
      }

      const nextRow = this.excelTable(ws, ['Hallazgo', 'Descripción'], insights, 4);

      // Estilo extra: alinear descripción a la izquierda y con wrap
      for (let r = 5; r < nextRow; r++) {
        const row = ws.getRow(r);
        row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
        row.height = 30;
      }
    }

    return this.toBuffer(wb);
  }

  // PÁGINA 2 — Empleabilidad

  async exportarEmpleabilidadPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc(); const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPageWithSubtitle(doc, 'Empleabilidad');
    const k = data.kpis; const total = k.total_egresados || 1;

    let y = this.pdfPageHeader(doc, 'Empleabilidad', filtros, fecha);
    y = this.pdfSection(doc, 'Indicadores de Empleabilidad', y, onNewPage);
    y = this.pdfTable(doc, ['Indicador', 'Valor'], [['Total Egresados', String(k.total_egresados)], ['Empleados', String(k.empleados)], ['Desempleados', String(k.desempleados)], ['% Empleados', `${((k.empleados / total) * 100).toFixed(1)}%`], ['Satisfacción Promedio', `${(+(k.satisfaccion_promedio) || 0).toFixed(2)} / 5`]], [260, 160], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Empleo por Carrera', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Total', 'Empleados', '% Emp.'], (data.empleabilidadCarrera || []).map((r: any) => [r.nombre_carrera, String(r.total), String(r.empleados), r.total > 0 ? `${((r.empleados / r.total) * 100).toFixed(1)}%` : '0%']), [220, 80, 80, 80], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Sector Laboral', y, onNewPage);
    y = this.pdfTable(doc, ['Sector', 'Total'], (data.sectorLaboral || []).map((r: any) => [r.sector || '—', String(r.total)]), [350, 100], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Top Empresas', y, onNewPage);
    y = this.pdfTable(doc, ['Empresa', 'Total'], (data.topEmpresas || []).map((r: any) => [r.empresa || '—', String(r.total)]), [350, 100], MARGIN_X, y, onNewPage);
    if ((data.coincidenciaCarrera || []).length > 0) { y = this.pdfSection(doc, 'Coincidencia con Carrera', y); y = this.pdfTable(doc, ['Carrera', 'Coincidencia', 'Total', '%'], (data.coincidenciaCarrera || []).map((r: any) => [r.nombre_carrera, r.coincidencia, String(r.total), `${(+(r.porcentaje) || 0).toFixed(1)}%`]), [220, 120, 80, 80], MARGIN_X, y, onNewPage); }
    if ((data.tiempoEmpleoCarrera || []).length > 0) { y = this.pdfSection(doc, 'Tiempo para Emplearse por Carrera', y); this.pdfTable(doc, ['Carrera', 'Total Egresados', 'Años Prom.'], (data.tiempoEmpleoCarrera || []).map((r: any) => [r.nombre_carrera, String(r.total_egresados), `${(+(r.anios_promedio_para_emplearse) || 0).toFixed(2)} años`]), [280, 100, 120], MARGIN_X, y, onNewPage); }
    this.pdfFooter(doc, fecha); doc.end(); return bufPromise;
  }

  async exportarEmpleabilidadExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Empleabilidad', filtros, fecha, () => 0);
    const k = data.kpis; const total = k.total_egresados || 1;
    { const ws = addSheet('KPIs', 2, 'Empleabilidad — KPIs'); ws.columns = [{ key: 'ind', width: 28 }, { key: 'val', width: 20 }]; this.excelTable(ws, ['Indicador', 'Valor'], [['Total Egresados', k.total_egresados], ['Empleados', k.empleados], ['Desempleados', k.desempleados], ['% Empleados', +((k.empleados / total) * 100).toFixed(2)], ['Satisfacción Promedio', k.satisfaccion_promedio]], 4); }
    { const ws = addSheet('Empleo Carrera', 4, 'Empleo por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 12 }, { key: 'e', width: 14 }, { key: 'p', width: 16 }]; this.excelTable(ws, ['Carrera', 'Total', 'Empleados', '% Empleados'], (data.empleabilidadCarrera || []).map((r: any) => [r.nombre_carrera, r.total, r.empleados, r.total > 0 ? +((r.empleados / r.total) * 100).toFixed(2) : 0]), 4); }
    { const ws = addSheet('Sector Laboral', 2, 'Sector Laboral'); ws.columns = [{ key: 's', width: 30 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Sector', 'Total'], (data.sectorLaboral || []).map((r: any) => [r.sector, r.total]), 4); }
    { const ws = addSheet('Top Empresas', 2, 'Top Empresas'); ws.columns = [{ key: 'e', width: 35 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Empresa', 'Total'], (data.topEmpresas || []).map((r: any) => [r.empresa || '—', r.total]), 4); }
    { const ws = addSheet('Coincidencia', 4, 'Coincidencia Laboral con Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 'co', width: 22 }, { key: 't', width: 12 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Carrera', 'Coincidencia con carrera', 'Total', 'Porcentaje'], (data.coincidenciaCarrera || []).map((r: any) => [r.nombre_carrera, r.coincidencia, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Tiempo de Empleo', 3, 'Tiempo para Emplearse por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 18 }, { key: 'a', width: 28 }]; this.excelTable(ws, ['Carrera', 'Total Egresados', 'Años Promedio para Emplearse'], (data.tiempoEmpleoCarrera || []).map((r: any) => [r.nombre_carrera, r.total_egresados, r.anios_promedio_para_emplearse]), 4); }
    return this.toBuffer(wb);
  }

  // PÁGINA 3 — Titulación

  async exportarTitulacionPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc(); const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPageWithSubtitle(doc, 'Titulación');
    const k = data.kpis;

    let y = this.pdfPageHeader(doc, 'Titulación', filtros, fecha);
    y = this.pdfSection(doc, 'Indicadores de Titulación', y, onNewPage);
    y = this.pdfTable(doc, ['Indicador', 'Valor'], [['Total Egresados', String(k.total_egresados)], ['Titulados', String(k.titulados)], ['En Trámite', String(k.en_tramite)], ['No Titulados', String(k.no_titulados)]], [260, 160], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Titulación por Carrera', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Total', 'Titulados', 'Trámite', 'No Tit.', '% Tit.'], (data.titulacionCarrera || []).map((r: any) => [r.nombre_carrera, String(r.total), String(r.titulados), String(r.en_tramite), String(r.no_titulados), `${(+(r.pct_titulados) || 0).toFixed(1)}%`]), [200, 65, 75, 75, 75, 75], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Titulación por Año', y, onNewPage);
    y = this.pdfTable(doc, ['Año', 'Total', 'Titulados', 'En Trámite', '% Tit.'], (data.titulacionAnio || []).map((r: any) => [String(r.anio_egreso), String(r.total), String(r.titulados), String(r.en_tramite), `${(+(r.pct_titulados) || 0).toFixed(1)}%`]), [80, 80, 100, 100, 100], MARGIN_X, y, onNewPage);
    if ((data.posgradoPorTipo || []).length > 0) { y = this.pdfSection(doc, 'Posgrado por Tipo', y, onNewPage); this.pdfTable(doc, ['Tipo de Posgrado', 'Total'], (data.posgradoPorTipo || []).map((r: any) => [r.tipo_posgrado || '—', String(r.total)]), [300, 100], MARGIN_X, y, onNewPage); }
    this.pdfFooter(doc, fecha); doc.end(); return bufPromise;
  }

  async exportarTitulacionExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Titulación', filtros, fecha, () => 0);
    const k = data.kpis;
    { const ws = addSheet('KPIs', 2, 'Titulación — KPIs'); ws.columns = [{ key: 'ind', width: 28 }, { key: 'val', width: 20 }]; this.excelTable(ws, ['Indicador', 'Valor'], [['Total Egresados', k.total_egresados], ['Titulados', k.titulados], ['En Trámite', k.en_tramite], ['No Titulados', k.no_titulados]], 4); }
    { const ws = addSheet('Por Carrera', 8, 'Titulación por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 10 }, { key: 'tt', width: 14 }, { key: 'tr', width: 14 }, { key: 'nt', width: 16 }, { key: 'pt', width: 14 }, { key: 'ptr', width: 14 }, { key: 'pnt', width: 16 }]; this.excelTable(ws, ['Carrera', 'Total', 'Titulados', 'En Trámite', 'No Titulados', '% Titulados', '% Trámite', '% No Titulados'], (data.titulacionCarrera || []).map((r: any) => [r.nombre_carrera, r.total, r.titulados, r.en_tramite, r.no_titulados, r.pct_titulados, r.pct_en_tramite, r.pct_no_titulados]), 4); }
    { const ws = addSheet('Por Año', 5, 'Titulación por Año de Egreso'); ws.columns = [{ key: 'a', width: 12 }, { key: 't', width: 12 }, { key: 'tt', width: 14 }, { key: 'tr', width: 14 }, { key: 'p', width: 16 }]; this.excelTable(ws, ['Año', 'Total', 'Titulados', 'En Trámite', '% Titulados'], (data.titulacionAnio || []).map((r: any) => [r.anio_egreso, r.total, r.titulados, r.en_tramite, r.pct_titulados]), 4); }
    { const ws = addSheet('Posgrado', 2, 'Posgrado por Tipo'); ws.columns = [{ key: 'tipo', width: 30 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Tipo de Posgrado', 'Total'], (data.posgradoPorTipo || []).map((r: any) => [r.tipo_posgrado || '—', r.total]), 4); }
    { const ws = addSheet('Detalle Carrera-Año', 7, 'Titulación por Carrera y Año'); ws.columns = [{ key: 'c', width: 35 }, { key: 'a', width: 12 }, { key: 't', width: 12 }, { key: 'tt', width: 14 }, { key: 'tr', width: 14 }, { key: 'nt', width: 16 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Carrera', 'Año', 'Total', 'Titulados', 'En Trámite', 'No Titulados', '% Titulados'], (data.titulacionCarreraAnio || []).map((r: any) => [r.nombre_carrera, r.anio_egreso, r.total, r.titulados, r.en_tramite, r.no_titulados, r.pct_titulados]), 4); }
    return this.toBuffer(wb);
  }

  // PÁGINA 4 — Vinculación

  async exportarVinculacionPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const [estadisticas, satisfaccion, colaboraciones, habilidades] = await Promise.all([this.egresadosService.getEstadisticas(carrera, anio), this.egresadosService.getDistribucionSatisfaccion(carrera, anio), this.egresadosService.getTotalesColaboraciones(carrera, anio), this.egresadosService.getTotalesHabilidades(carrera, anio)]);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc(); const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPageWithSubtitle(doc, 'Vinculación');
    const k = estadisticas.kpis;

    let y = this.pdfPageHeader(doc, 'Vinculación', filtros, fecha);
    y = this.pdfSection(doc, 'Autorizaciones', y, onNewPage);
    y = this.pdfTable(doc, ['Tipo', 'Total'], [['Autorizó Contacto', String(k.autorizo_contacto)], ['Autorizó Eventos', String(k.autorizo_eventos)], ['Total Egresados', String(k.total_egresados)]], [260, 160], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Distribución de Satisfacción', y, onNewPage);
    y = this.pdfTable(doc, ['Nivel (1-5)', 'Total'], (satisfaccion || []).map((r: any) => [String(r.nivel), String(r.total)]), [200, 120], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Colaboraciones', y, onNewPage);
    y = this.pdfTable(doc, ['Tipo de Colaboración', 'Total'], (colaboraciones || []).map((r: any) => [r.descripcion || '—', String(r.total)]), [340, 100], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Habilidades', y, onNewPage);
    this.pdfTable(doc, ['Habilidad', 'Total'], (habilidades || []).map((r: any) => [r.habilidad || '—', String(r.total)]), [340, 100], MARGIN_X, y, onNewPage);
    this.pdfFooter(doc, fecha); doc.end(); return bufPromise;
  }

  async exportarVinculacionExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const [estadisticas, satisfaccion, colaboraciones, habilidades] = await Promise.all([this.egresadosService.getEstadisticas(carrera, anio), this.egresadosService.getDistribucionSatisfaccion(carrera, anio), this.egresadosService.getTotalesColaboraciones(carrera, anio), this.egresadosService.getTotalesHabilidades(carrera, anio)]);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Vinculación', filtros, fecha, () => 0);
    const k = estadisticas.kpis;
    { const ws = addSheet('Autorizaciones', 2, 'Autorizaciones'); ws.columns = [{ key: 'tipo', width: 30 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Tipo', 'Total'], [['Autorizó Contacto', k.autorizo_contacto], ['Autorizó Eventos', k.autorizo_eventos], ['Total Egresados', k.total_egresados]], 4); }
    { const ws = addSheet('Satisfacción', 2, 'Distribución de Satisfacción'); ws.columns = [{ key: 'n', width: 15 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Nivel (1-5)', 'Total'], (satisfaccion || []).map((r: any) => [r.nivel, r.total]), 4); }
    { const ws = addSheet('Colaboraciones', 2, 'Tipos de Colaboración'); ws.columns = [{ key: 'd', width: 35 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Tipo de Colaboración', 'Total'], (colaboraciones || []).map((r: any) => [r.descripcion || '—', r.total]), 4); }
    { const ws = addSheet('Habilidades', 2, 'Habilidades'); ws.columns = [{ key: 'h', width: 35 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Habilidad', 'Total'], (habilidades || []).map((r: any) => [r.habilidad || '—', r.total]), 4); }
    return this.toBuffer(wb);
  }

  // PÁGINA 5 — Comparativas

  async exportarComparativasPdf(carreras: string[]): Promise<Buffer> {
    const data = await this.egresadosService.getComparativas(carreras);
    const fecha = this.fechaStr(); const filtros = `Carreras: ${carreras.join(', ')}`;
    const doc = this.pdfDoc(); const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPageWithSubtitle(doc, 'Comparativas entre Carreras');

    let y = this.pdfPageHeader(doc, 'Comparativas entre Carreras', filtros, fecha);
    y = this.pdfSection(doc, 'Resumen por Carrera', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Total', '% Emp.', '% Tit.', 'Satisf.', '% F.Dgo.'], (data.resumen || []).map((r: any) => [r.nombre_carrera, String(r.total), `${(+(r.pct_empleados) || 0).toFixed(1)}%`, `${(+(r.pct_titulados) || 0).toFixed(1)}%`, (+(r.satisfaccion_promedio) || 0).toFixed(2), `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`]), [200, 60, 70, 70, 75, 85], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Empleo', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Total', 'Empleados', 'Desempl.', '% Emp.'], (data.empleo || []).map((r: any) => [r.nombre_carrera, String(r.total), String(r.empleados), String(r.desempleados), `${(+(r.pct_empleados) || 0).toFixed(1)}%`]), [200, 70, 85, 85, 80], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Titulación', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Total', 'Titulados', 'Trámite', 'No Tit.', '% Tit.'], (data.titulacion || []).map((r: any) => [r.nombre_carrera, String(r.total), String(r.titulados), String(r.en_tramite), String(r.no_titulados), `${(+(r.pct_titulados) || 0).toFixed(1)}%`]), [200, 65, 80, 80, 80, 80], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Migración', y, onNewPage);
    this.pdfTable(doc, ['Carrera', 'En Dgo.', 'Fuera Dgo.', 'Extranjero', '% F.Dgo.', '% Ext.'], (data.migracion || []).map((r: any) => [r.nombre_carrera, String(r.en_durango), String(r.fuera_durango_mexico), String(r.en_extranjero), `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`, `${(+(r.pct_extranjero) || 0).toFixed(1)}%`]), [200, 70, 90, 90, 80, 80], MARGIN_X, y, onNewPage);
    this.pdfFooter(doc, fecha); doc.end(); return bufPromise;
  }

  async exportarComparativasExcel(carreras: string[]): Promise<Buffer> {
    const data = await this.egresadosService.getComparativas(carreras);
    const fecha = this.fechaStr(); const filtros = `Carreras: ${carreras.join(', ')}`;
    const { wb, addSheet } = this.makeWorkbook('Comparativas', filtros, fecha, () => 0);
    { const ws = addSheet('Resumen', 6, 'Resumen por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 12 }, { key: 'pe', width: 14 }, { key: 'pt', width: 14 }, { key: 's', width: 16 }, { key: 'pd', width: 18 }]; this.excelTable(ws, ['Carrera', 'Total', '% Empleados', '% Titulados', 'Satisfacción', '% Fuera Durango'], (data.resumen || []).map((r: any) => [r.nombre_carrera, r.total, r.pct_empleados, r.pct_titulados, r.satisfaccion_promedio, r.pct_fuera_durango]), 4); }
    { const ws = addSheet('Empleo', 5, 'Empleo por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 12 }, { key: 'e', width: 14 }, { key: 'd', width: 14 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Carrera', 'Total', 'Empleados', 'Desempleados', '% Empleados'], (data.empleo || []).map((r: any) => [r.nombre_carrera, r.total, r.empleados, r.desempleados, r.pct_empleados]), 4); }
    { const ws = addSheet('Titulación', 8, 'Titulación por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 10 }, { key: 'tt', width: 14 }, { key: 'tr', width: 14 }, { key: 'nt', width: 16 }, { key: 'pt', width: 14 }, { key: 'ptr', width: 12 }, { key: 'pnt', width: 14 }]; this.excelTable(ws, ['Carrera', 'Total', 'Titulados', 'En Trámite', 'No Titulados', '% Titulados', '% Trámite', '% No Titulados'], (data.titulacion || []).map((r: any) => [r.nombre_carrera, r.total, r.titulados, r.en_tramite, r.no_titulados, r.pct_titulados, r.pct_en_tramite, r.pct_no_titulados]), 4); }
    { const ws = addSheet('Sector Laboral', 4, 'Sector Laboral por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 's', width: 25 }, { key: 't', width: 12 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Carrera', 'Sector', 'Total', 'Porcentaje'], (data.sectorCarrera || []).map((r: any) => [r.nombre_carrera, r.sector, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Inglés', 4, 'Nivel de Inglés por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 'n', width: 20 }, { key: 't', width: 12 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Carrera', 'Nivel', 'Total', 'Porcentaje'], (data.ingles || []).map((r: any) => [r.nombre_carrera, r.nivel, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Satisfacción', 8, 'Satisfacción por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 'p', width: 14 }, { key: 't', width: 10 }, { key: 'ms', width: 16 }, { key: 's', width: 14 }, { key: 'n', width: 12 }, { key: 'i', width: 14 }, { key: 'mi', width: 16 }]; this.excelTable(ws, ['Carrera', 'Promedio', 'Total', 'Muy Satisfecho', 'Satisfecho', 'Neutral', 'Insatisfecho', 'Muy Insatisfecho'], (data.satisfaccion || []).map((r: any) => [r.nombre_carrera, r.promedio, r.total, r.muy_satisfecho, r.satisfecho, r.neutral, r.insatisfecho, r.muy_insatisfecho]), 4); }
    { const ws = addSheet('Migración', 7, 'Migración y Movilidad por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 10 }, { key: 'ed', width: 16 }, { key: 'fd', width: 18 }, { key: 'ex', width: 16 }, { key: 'pfd', width: 16 }, { key: 'pex', width: 16 }]; this.excelTable(ws, ['Carrera', 'Total', 'En Durango', 'Fuera Dgo.', 'Extranjero', '% Fuera Dgo.', '% Extranjero'], (data.migracion || []).map((r: any) => [r.nombre_carrera, r.total, r.en_durango, r.fuera_durango_mexico, r.en_extranjero, r.pct_fuera_durango, r.pct_extranjero]), 4); }
    return this.toBuffer(wb);
  }

  // PÁGINA 6 — Distribución Geográfica

  async exportarGeografiaPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getDistribucionGeografica(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc(); const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPageWithSubtitle(doc, 'Distribución Geográfica');
    const k = data.kpisGeo;

    let y = this.pdfPageHeader(doc, 'Distribución Geográfica', filtros, fecha);
    y = this.pdfSection(doc, 'Indicadores Geográficos', y, onNewPage);
    y = this.pdfTable(doc, ['Indicador', 'Valor'], [['Total Mapeados', String(k.total_mapeados)], ['Con Ciudad de Trabajo', String(k.con_ciudad_trabajo)], ['En Extranjero', String(k.en_extranjero)], ['Países Distintos', String(k.paises_distintos)], ['Ciudades de Trabajo Distintas', String(k.ciudades_trabajo_distintas)]], [300, 150], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Top Ciudades de Trabajo', y, onNewPage);
    y = this.pdfTable(doc, ['#', 'Ciudad', 'Total'], (data.topCiudadesTrabajo || []).map((r: any, i: number) => [String(i + 1), r.ciudad_trabajo || '—', String(r.total)]), [40, 330, 80], MARGIN_X, y, onNewPage);
    if ((data.extranjerosPorPais || []).length > 0) { y = this.pdfSection(doc, 'Extranjeros por País', y); y = this.pdfTable(doc, ['País', 'Total'], (data.extranjerosPorPais || []).map((r: any) => [r.pais || '—', String(r.total)]), [290, 100], MARGIN_X, y, onNewPage); }
    y = this.pdfSection(doc, 'Movilidad por Año', y, onNewPage);
    y = this.pdfTable(doc, ['Año', 'Total', 'Fuera Dgo.', 'Extranjero', '% F.Dgo.', '% Ext.'], (data.movilidadPorAnio || []).map((r: any) => [String(r.anio_egreso), String(r.total), String(r.fuera_durango), String(r.en_extranjero), `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`, `${(+(r.pct_extranjero) || 0).toFixed(1)}%`]), [70, 70, 90, 90, 90, 90], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Movilidad por Carrera', y, onNewPage);
    this.pdfTable(doc, ['Carrera', 'Total', 'Fuera Durango', '% Fuera Dgo.'], (data.movilidadPorCarrera || []).map((r: any) => [r.nombre_carrera, String(r.total), String(r.fuera_durango), `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`]), [260, 70, 110, 110], MARGIN_X, y, onNewPage);
    this.pdfFooter(doc, fecha); doc.end(); return bufPromise;
  }

  async exportarGeografiaExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getDistribucionGeografica(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Distribución Geográfica', filtros, fecha, () => 0);
    const k = data.kpisGeo;
    { const ws = addSheet('KPIs', 2, 'Distribución Geográfica — KPIs'); ws.columns = [{ key: 'ind', width: 35 }, { key: 'val', width: 20 }]; this.excelTable(ws, ['Indicador', 'Valor'], [['Total Mapeados', k.total_mapeados], ['Con Ciudad de Trabajo', k.con_ciudad_trabajo], ['En Extranjero', k.en_extranjero], ['Países Distintos', k.paises_distintos], ['Ciudades de Trabajo Distintas', k.ciudades_trabajo_distintas]], 4); }
    { const ws = addSheet('Top Ciudades', 3, 'Top Ciudades de Trabajo'); ws.columns = [{ key: 'r', width: 12 }, { key: 'c', width: 35 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Ranking', 'Ciudad de Trabajo', 'Total'], (data.topCiudadesTrabajo || []).map((r: any, i: number) => [i + 1, r.ciudad_trabajo, r.total]), 4); }
    { const ws = addSheet('Extranjeros País', 2, 'Egresados en el Extranjero por País'); ws.columns = [{ key: 'p', width: 30 }, { key: 't', width: 15 }]; this.excelTable(ws, ['País', 'Total'], (data.extranjerosPorPais || []).map((r: any) => [r.pais, r.total]), 4); }
    { const ws = addSheet('Detalle Extranjeros', 3, 'Detalle de Egresados en el Extranjero'); ws.columns = [{ key: 'c', width: 30 }, { key: 'p', width: 25 }, { key: 't', width: 15 }]; this.excelTable(ws, ['Ciudad', 'País', 'Total'], (data.extranjerosDetalle || []).map((r: any) => [r.ciudad_trabajo, r.pais, r.total]), 4); }
    { const ws = addSheet('Movilidad Año', 6, 'Movilidad por Año de Egreso'); ws.columns = [{ key: 'a', width: 12 }, { key: 't', width: 12 }, { key: 'fd', width: 18 }, { key: 'ex', width: 16 }, { key: 'pfd', width: 18 }, { key: 'pex', width: 16 }]; this.excelTable(ws, ['Año', 'Total', 'Fuera Durango', 'En Extranjero', '% Fuera Durango', '% Extranjero'], (data.movilidadPorAnio || []).map((r: any) => [r.anio_egreso, r.total, r.fuera_durango, r.en_extranjero, r.pct_fuera_durango, r.pct_extranjero]), 4); }
    { const ws = addSheet('Movilidad Carrera', 4, 'Movilidad por Carrera'); ws.columns = [{ key: 'c', width: 35 }, { key: 't', width: 12 }, { key: 'fd', width: 18 }, { key: 'p', width: 18 }]; this.excelTable(ws, ['Carrera', 'Total', 'Fuera Durango', '% Fuera Durango'], (data.movilidadPorCarrera || []).map((r: any) => [r.nombre_carrera, r.total, r.fuera_durango, r.pct_fuera_durango]), 4); }
    return this.toBuffer(wb);
  }

  // PÁGINA 7 — Géneros

  async exportarGenerosPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticasGenero(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc(); const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPageWithSubtitle(doc, 'Estadísticas por Género');

    let y = this.pdfPageHeader(doc, 'Estadísticas por Género', filtros, fecha);
    y = this.pdfSection(doc, 'KPIs por Género', y, onNewPage);
    y = this.pdfTable(doc, ['Género', 'Total', 'Porcentaje'], (data.kpisGenero || []).map((r: any) => [r.genero, String(r.total), `${(+(r.porcentaje) || 0).toFixed(1)}%`]), [200, 100, 100], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Empleabilidad por Género', y, onNewPage);
    y = this.pdfTable(doc, ['Género', 'Total', 'Empleados', 'Desempl.', '% Emp.', 'Satisf.'], (data.empleabilidadGenero || []).map((r: any) => [r.genero, String(r.total), String(r.empleados), String(r.desempleados), `${(+(r.pct_empleados) || 0).toFixed(1)}%`, (+(r.satisfaccion_promedio) || 0).toFixed(2)]), [120, 70, 85, 85, 80, 80], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Titulación por Género', y, onNewPage);
    y = this.pdfTable(doc, ['Género', 'Total', 'Titulados', 'Trámite', 'No Tit.', '% Tit.'], (data.titulacionGenero || []).map((r: any) => [r.genero, String(r.total), String(r.titulados), String(r.en_tramite), String(r.no_titulados), `${(+(r.pct_titulados) || 0).toFixed(1)}%`]), [120, 70, 90, 90, 90, 90], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Nivel de Inglés por Género', y, onNewPage);
    y = this.pdfTable(doc, ['Género', 'Nivel', 'Total', 'Porcentaje'], (data.inglesGenero || []).map((r: any) => [r.genero, r.nivel, String(r.total), `${(+(r.porcentaje) || 0).toFixed(1)}%`]), [120, 180, 80, 100], MARGIN_X, y, onNewPage);
    y = this.pdfSection(doc, 'Satisfacción por Género', y, onNewPage);
    this.pdfTable(doc, ['Género', 'Prom.', 'Total', 'M.Satis.', 'Satis.', 'Neutral', 'Insat.', 'M.Insat.'], (data.satisfaccionGenero || []).map((r: any) => [r.genero, (+(r.promedio) || 0).toFixed(2), String(r.total), String(r.muy_satisfecho), String(r.satisfecho), String(r.neutral), String(r.insatisfecho), String(r.muy_insatisfecho)]), [100, 65, 65, 80, 70, 70, 70, 80], MARGIN_X, y, onNewPage);
    this.pdfFooter(doc, fecha); doc.end(); return bufPromise;
  }

  async exportarGenerosExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticasGenero(carrera, anio);
    const fecha = this.fechaStr(); const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Estadísticas por Género', filtros, fecha, () => 0);
    { const ws = addSheet('KPIs Género', 3, 'KPIs por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 't', width: 15 }, { key: 'p', width: 16 }]; this.excelTable(ws, ['Género', 'Total', 'Porcentaje'], (data.kpisGenero || []).map((r: any) => [r.genero, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Egreso por Año', 4, 'Egreso por Año y Género'); ws.columns = [{ key: 'a', width: 12 }, { key: 'g', width: 20 }, { key: 't', width: 12 }, { key: 'p', width: 18 }]; this.excelTable(ws, ['Año', 'Género', 'Total', '% en Año'], (data.egresoAnioGenero || []).map((r: any) => [r.anio_egreso, r.genero, r.total, r.porcentaje_en_anio]), 4); }
    { const ws = addSheet('Composición', 4, 'Composición por Carrera y Género'); ws.columns = [{ key: 'c', width: 35 }, { key: 'g', width: 20 }, { key: 't', width: 12 }, { key: 'p', width: 16 }]; this.excelTable(ws, ['Carrera', 'Género', 'Total', 'Porcentaje'], (data.composicionCarreraGenero || []).map((r: any) => [r.nombre_carrera, r.genero, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Empleabilidad', 6, 'Empleabilidad por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 't', width: 12 }, { key: 'e', width: 14 }, { key: 'd', width: 14 }, { key: 'p', width: 14 }, { key: 's', width: 20 }]; this.excelTable(ws, ['Género', 'Total', 'Empleados', 'Desempleados', '% Empleados', 'Satisfacción Promedio'], (data.empleabilidadGenero || []).map((r: any) => [r.genero, r.total, r.empleados, r.desempleados, r.pct_empleados, r.satisfaccion_promedio]), 4); }
    { const ws = addSheet('Sector Laboral', 4, 'Sector Laboral por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 's', width: 25 }, { key: 't', width: 12 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Género', 'Sector', 'Total', 'Porcentaje'], (data.sectorLaboralGenero || []).map((r: any) => [r.genero, r.sector, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Titulación', 8, 'Titulación por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 't', width: 10 }, { key: 'tt', width: 14 }, { key: 'tr', width: 14 }, { key: 'nt', width: 16 }, { key: 'pt', width: 14 }, { key: 'ptr', width: 12 }, { key: 'pnt', width: 14 }]; this.excelTable(ws, ['Género', 'Total', 'Titulados', 'En Trámite', 'No Titulados', '% Titulados', '% Trámite', '% No Titulados'], (data.titulacionGenero || []).map((r: any) => [r.genero, r.total, r.titulados, r.en_tramite, r.no_titulados, r.pct_titulados, r.pct_en_tramite, r.pct_no_titulados]), 4); }
    { const ws = addSheet('Tiempo de Empleo', 2, 'Tiempo para Emplearse por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 'a', width: 25 }]; this.excelTable(ws, ['Género', 'Años Promedio'], (data.tiempoEmpleoGenero || []).map((r: any) => [r.genero, r.tiempo_promedio_anios]), 4); }
    { const ws = addSheet('Coincidencia', 4, 'Coincidencia Laboral por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 'co', width: 22 }, { key: 't', width: 12 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Género', 'Coincidencia', 'Total', 'Porcentaje'], (data.coincidenciaLaboralGenero || []).map((r: any) => [r.genero, r.coincidencia, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Nivel de Inglés', 4, 'Nivel de Inglés por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 'n', width: 22 }, { key: 't', width: 12 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Género', 'Nivel', 'Total', 'Porcentaje'], (data.inglesGenero || []).map((r: any) => [r.genero, r.nivel, r.total, r.porcentaje]), 4); }
    { const ws = addSheet('Satisfacción', 8, 'Satisfacción por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 'p', width: 14 }, { key: 't', width: 10 }, { key: 'ms', width: 16 }, { key: 's', width: 14 }, { key: 'n', width: 12 }, { key: 'i', width: 14 }, { key: 'mi', width: 18 }]; this.excelTable(ws, ['Género', 'Promedio', 'Total', 'Muy Satis.', 'Satisfecho', 'Neutral', 'Insatisfecho', 'Muy Insatis.'], (data.satisfaccionGenero || []).map((r: any) => [r.genero, r.promedio, r.total, r.muy_satisfecho, r.satisfecho, r.neutral, r.insatisfecho, r.muy_insatisfecho]), 4); }
    { const ws = addSheet('Habilidades', 4, 'Habilidades por Género'); ws.columns = [{ key: 'g', width: 20 }, { key: 'h', width: 30 }, { key: 't', width: 12 }, { key: 'p', width: 14 }]; this.excelTable(ws, ['Género', 'Habilidad', 'Total', 'Porcentaje'], (data.habilidadesGenero || []).map((r: any) => [r.genero, r.habilidad, r.total, r.porcentaje]), 4); }
    return this.toBuffer(wb);
  }
}