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

  private readonly ORDEN_RANGOS_TIEMPO = [
    'Menos de 3 meses',
    'De 3 a 6 meses',
    'De 6 meses a 1 año',
    'De 1 a 2 años',
    'Más de 2 años',
    'Aún no he conseguido empleo',
  ];

  private filtroDescEmpleo(carrera?: string, anio?: number, tiempo?: string, medio?: string): string {
    const p: string[] = [];
    if (carrera) p.push(`Carrera: ${carrera}`);
    if (anio) p.push(`Año: ${anio}`);
    if (tiempo) p.push(`Tiempo: ${tiempo}`);
    if (medio) p.push(`Medio: ${medio}`);
    return p.length ? p.join('  |  ') : 'Sin filtros';
  }

  private formatTiempoMeses(anios: number): string {
    const totalMeses = Math.round((Number(anios) || 0) * 12);
    if (totalMeses <= 0) return '—';

    if (totalMeses < 12) {
      return `${totalMeses} ${totalMeses === 1 ? 'mes' : 'meses'}`;
    }

    const aniosEnteros = Math.floor(totalMeses / 12);
    const meses = totalMeses % 12;
    const parteAnios = `${aniosEnteros} ${aniosEnteros === 1 ? 'año' : 'años'}`;

    return meses === 0 ? parteAnios : `${parteAnios} y ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }

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
    rowHeight?: number,
  ): number {
    const ROW_H = rowHeight ?? 26;
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

    if (y + 40 > PAGE_MAX_Y) {
      if (onNewPage) y = onNewPage();
      y += 6;
    }

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

  async exportarEmpleabilidadPdf(carrera?: string, anio?: number, tiempo?: string, medio?: string): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio, tiempo, medio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDescEmpleo(carrera, anio, tiempo, medio);
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPage(doc);

    const k = data.kpis;
    const total = k.total_egresados || 1;

    // Página 1: encabezado principal (solo aquí va el título)
    let y = this.pdfPageHeader(doc, 'Empleabilidad', filtros, fecha);

    // 1) Indicadores de Empleabilidad
    y = this.pdfSection(doc, 'Indicadores de Empleabilidad', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Indicador', 'Valor'],
      [
        ['Total Egresados', String(k.total_egresados)],
        ['Empleados', String(k.empleados)],
        ['Desempleados', String(k.desempleados)],
        ['% Empleados', `${((k.empleados / total) * 100).toFixed(1)}%`],
        ['Satisfacción Promedio', `${(+(k.satisfaccion_promedio) || 0).toFixed(2)} / 5`],
      ],
      [260, 160], MARGIN_X, y, onNewPage,
    );

    // 2) Sectores donde trabajan los egresados
    y = this.pdfSection(doc, 'Sectores donde Trabajan los Egresados', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Sector', 'Total'],
      (data.sectorLaboral || []).map((r: any) => [r.sector || '—', String(r.total)]),
      [350, 100], MARGIN_X, y, onNewPage,
    );

    // 3) Empleabilidad por Carrera
    y = this.pdfSection(doc, 'Empleabilidad por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Empleados', '% Emp.'],
      (data.empleabilidadCarrera || []).map((r: any) => [
        r.nombre_carrera,
        String(r.total),
        String(r.empleados),
        r.total > 0 ? `${((r.empleados / r.total) * 100).toFixed(1)}%` : '0%',
      ]),
      [220, 80, 80, 80], MARGIN_X, y, onNewPage,
    );

    // 3.1) Distribución de Tiempo para Emplearse (por rango)
    const distTiempo = data.distribucionTiempoEmpleo ?? [];
    if (distTiempo.length > 0) {
      const totalPorRango: Record<string, number> = {};
      for (const f of distTiempo) {
        totalPorRango[f.rango] = (totalPorRango[f.rango] || 0) + Number(f.total);
      }
      const rangos = this.ORDEN_RANGOS_TIEMPO.filter(r => (totalPorRango[r] || 0) > 0);
      const totalTiempo = rangos.reduce((a, r) => a + totalPorRango[r], 0) || 1;

      y = this.pdfSection(doc, 'Distribución de Tiempo para Emplearse', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Rango de Tiempo', 'Egresados', '%'],
        rangos.map(r => [
          r,
          String(totalPorRango[r]),
          `${((totalPorRango[r] / totalTiempo) * 100).toFixed(1)}%`,
        ]),
        [280, 100, 100], MARGIN_X, y, onNewPage,
      );
    }

    // 3.2) Medio de Obtención del Primer Empleo
    const mediosEmpleo = [...(data.medioPrimerEmpleo ?? [])]
      .sort((a: any, b: any) => Number(a.orden) - Number(b.orden));
    if (mediosEmpleo.length > 0) {
      const totalMedio = mediosEmpleo.reduce((a, m: any) => a + Number(m.total), 0) || 1;
      y = this.pdfSection(doc, 'Medio de Obtención del Primer Empleo', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Medio', 'Egresados', '%'],
        mediosEmpleo.map((m: any) => [
          m.medio || '—',
          String(m.total),
          `${((Number(m.total) / totalMedio) * 100).toFixed(1)}%`,
        ]),
        [280, 100, 100], MARGIN_X, y, onNewPage,
      );
    }

    // 4) Tiempo para Emplearse
    if ((data.tiempoEmpleoCarrera || []).length > 0) {
      y = this.pdfSection(doc, 'Tiempo para Emplearse por Carrera', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Carrera', 'Total Egresados', 'Tiempo Prom.'],
        (data.tiempoEmpleoCarrera || [])
          .sort((a: any, b: any) => +(a.anios_promedio_para_emplearse) - +(b.anios_promedio_para_emplearse))
          .map((r: any) => [
            r.nombre_carrera,
            String(r.total_egresados),
            this.formatTiempoMeses(+(r.anios_promedio_para_emplearse) || 0),
          ]),
        [280, 100, 120], MARGIN_X, y, onNewPage,
      );
    }

    // 5) Coincidencia Carrera–Trabajo (resumen % positivo por carrera)
    if ((data.coincidenciaCarrera || []).length > 0) {
      // Agrupar: una fila por carrera con todas sus coincidencias
      const mapaCoincidencia = new Map<string, { total: number; rows: any[] }>();
      for (const item of data.coincidenciaCarrera) {
        if (!mapaCoincidencia.has(item.nombre_carrera)) {
          mapaCoincidencia.set(item.nombre_carrera, { total: 0, rows: [] });
        }
        const entry = mapaCoincidencia.get(item.nombre_carrera)!;
        entry.total += Number(item.total);
        entry.rows.push(item);
      }

      const coincidenciaRows = (data.coincidenciaCarrera || []).map((r: any) => [
        r.nombre_carrera,
        r.coincidencia || '—',
        String(r.total),
        `${(+(r.porcentaje) || 0).toFixed(1)}%`,
      ]);

      y = this.pdfSection(doc, 'Coincidencia Carrera–Trabajo', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Carrera', 'Coincidencia', 'Total', '%'],
        coincidenciaRows,
        [220, 160, 60, 60], MARGIN_X, y, onNewPage,
      );
    }

    // 6) Top Empresas Empleadoras
    y = this.pdfSection(doc, 'Top Empresas Empleadoras', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Empresa', 'Total'],
      (data.topEmpresas || []).map((r: any) => [r.empresa || '—', String(r.total)]),
      [350, 100], MARGIN_X, y, onNewPage,
    );

    // 7) Detalle por Carrera (resumen cruzado: empleo + tiempo + coincidencia positiva)
    y = this.pdfSection(doc, 'Detalle por Carrera', y, onNewPage);

    // Construir mapa de tiempo por carrera (en meses)
    const tiempoMap = new Map<string, string>();
    for (const t of data.tiempoEmpleoCarrera || []) {
      tiempoMap.set(
        t.nombre_carrera,
        this.formatTiempoMeses(+(t.anios_promedio_para_emplearse) || 0),
      );
    }

    // Construir mapa de coincidencia positiva por carrera
    const coincPos = new Map<string, number>();
    const coincTotal = new Map<string, number>();
    for (const c of data.coincidenciaCarrera || []) {
      const prev = coincTotal.get(c.nombre_carrera) || 0;
      coincTotal.set(c.nombre_carrera, prev + Number(c.total));
      const esPositiva =
        c.coincidencia?.toLowerCase().includes('alta') ||
        c.coincidencia?.toLowerCase().includes('totalmente') ||
        c.coincidencia?.toLowerCase().includes('relacionad') ||
        c.coincidencia?.toLowerCase().includes('gran medida');
      if (esPositiva) {
        coincPos.set(c.nombre_carrera, (coincPos.get(c.nombre_carrera) || 0) + Number(c.total));
      }
    }

    const detalleRows = (data.empleabilidadCarrera || []).map((r: any) => {
      return [
        r.nombre_carrera,
        String(r.total),
        String(r.empleados),
        r.total > 0 ? `${((r.empleados / r.total) * 100).toFixed(1)}%` : '0%',
        tiempoMap.get(r.nombre_carrera) || '—',
      ];
    });

    y = this.pdfTable(
      doc,
      ['Carrera', 'Total Egresados', 'Empleados', 'Tasa de Empleo', 'Tiempo Estimado (Prom.)'],
      detalleRows,
      [200, 90, 80, 90, 100], MARGIN_X, y, onNewPage,
    );
    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarEmpleabilidadExcel(carrera?: string, anio?: number, tiempo?: string, medio?: string): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio, tiempo, medio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDescEmpleo(carrera, anio, tiempo, medio);
    const { wb, addSheet } = this.makeWorkbook('Empleabilidad', filtros, fecha, () => 0);
    const k = data.kpis;
    const total = k.total_egresados || 1;

    // 1) Indicadores de Empleabilidad
    {
      const ws = addSheet('Indicadores', 2, 'Indicadores de Empleabilidad');
      ws.columns = [{ key: 'ind', width: 28 }, { key: 'val', width: 20 }];
      this.excelTable(ws, ['Indicador', 'Valor'], [
        ['Total Egresados', k.total_egresados],
        ['Empleados', k.empleados],
        ['Desempleados', k.desempleados],
        ['% Empleados', +((k.empleados / total) * 100).toFixed(2)],
        ['Satisfacción Promedio', k.satisfaccion_promedio],
      ], 4);
    }

    // 2) Sectores donde trabajan los egresados
    {
      const ws = addSheet('Sectores', 2, 'Sectores donde Trabajan los Egresados');
      ws.columns = [{ key: 's', width: 38 }, { key: 't', width: 15 }];
      this.excelTable(ws, ['Sector', 'Total'],
        (data.sectorLaboral || []).map((r: any) => [r.sector || '—', r.total]),
        4,
      );
    }

    // 3) Empleabilidad por Carrera
    {
      const ws = addSheet('Empleo por Carrera', 4, 'Empleabilidad por Carrera');
      ws.columns = [
        { key: 'c', width: 38 },
        { key: 't', width: 12 },
        { key: 'e', width: 14 },
        { key: 'p', width: 16 },
      ];
      this.excelTable(ws, ['Carrera', 'Total', 'Empleados', '% Empleados'],
        (data.empleabilidadCarrera || []).map((r: any) => [
          r.nombre_carrera,
          r.total,
          r.empleados,
          r.total > 0 ? +((r.empleados / r.total) * 100).toFixed(2) : 0,
        ]),
        4,
      );
    }

    // 4) Tiempo para Emplearse
    {
      const ws = addSheet('Tiempo para Emplearse', 3, 'Tiempo para Emplearse por Carrera');
      ws.columns = [
        { key: 'c', width: 38 },
        { key: 't', width: 18 },
        { key: 'a', width: 28 },
      ];
      this.excelTable(ws, ['Carrera', 'Total Egresados', 'Tiempo Promedio para Emplearse'],
        [...(data.tiempoEmpleoCarrera || [])]
          .sort((a: any, b: any) => +(a.anios_promedio_para_emplearse) - +(b.anios_promedio_para_emplearse))
          .map((r: any) => [
            r.nombre_carrera,
            r.total_egresados,
            this.formatTiempoMeses(+(r.anios_promedio_para_emplearse) || 0),
          ]),
        4,
      );
    }

    // 5) Coincidencia Carrera–Trabajo
    {
      const ws = addSheet('Coincidencia', 4, 'Coincidencia Carrera–Trabajo');
      ws.columns = [
        { key: 'c', width: 38 },
        { key: 'co', width: 24 },
        { key: 't', width: 12 },
        { key: 'p', width: 14 },
      ];
      this.excelTable(ws, ['Carrera', 'Coincidencia con Carrera', 'Total', 'Porcentaje (%)'],
        (data.coincidenciaCarrera || []).map((r: any) => [
          r.nombre_carrera,
          r.coincidencia || '—',
          r.total,
          +(+(r.porcentaje) || 0).toFixed(1),
        ]),
        4,
      );
    }

    // 6) Top Empresas Empleadoras
    {
      const ws = addSheet('Top Empresas', 2, 'Top Empresas Empleadoras');
      ws.columns = [{ key: 'e', width: 38 }, { key: 't', width: 15 }];
      this.excelTable(ws, ['Empresa', 'Total'],
        (data.topEmpresas || []).map((r: any) => [r.empresa || '—', r.total]),
        4,
      );
    }

    // 7) Detalle por Carrera (vista cruzada consolidada)
    {
      const ws = addSheet('Detalle por Carrera', 5, 'Detalle por Carrera');
      ws.columns = [
        { key: 'c', width: 38 },
        { key: 't', width: 16 },
        { key: 'e', width: 14 },
        { key: 'te', width: 16 },
        { key: 'tp', width: 24 },
      ];

      // Mapa tiempo por carrera (en meses, ya formateado)
      const tiempoMap = new Map<string, string>();
      for (const t of data.tiempoEmpleoCarrera || []) {
        tiempoMap.set(t.nombre_carrera, this.formatTiempoMeses(+(t.anios_promedio_para_emplearse) || 0));
      }

      const detalleRows = (data.empleabilidadCarrera || []).map((r: any) => [
        r.nombre_carrera,
        r.total,
        r.empleados,
        r.total > 0 ? +((r.empleados / r.total) * 100).toFixed(2) : 0,
        tiempoMap.get(r.nombre_carrera) ?? '—',
      ]);

      const nextRow = this.excelTable(
        ws,
        ['Carrera', 'Total Egresados', 'Empleados', 'Tasa de Empleo (%)', 'Tiempo Estimado (Prom.)'],
        detalleRows,
        4,
      );

      // Formato de porcentaje solo en la columna de Tasa de Empleo
      for (let r = 5; r < nextRow; r++) {
        ws.getRow(r).getCell(4).numFmt = '0.00"%"';
      }
    }

    // Distribución de Tiempo para Emplearse
    {
      const distTiempo = data.distribucionTiempoEmpleo ?? [];
      const totalPorRango: Record<string, number> = {};
      for (const f of distTiempo) {
        totalPorRango[f.rango] = (totalPorRango[f.rango] || 0) + Number(f.total);
      }
      const rangos = this.ORDEN_RANGOS_TIEMPO.filter(r => (totalPorRango[r] || 0) > 0);
      const totalTiempo = rangos.reduce((a, r) => a + totalPorRango[r], 0) || 1;

      const ws = addSheet('Tiempo (Distribución)', 3, 'Distribución de Tiempo para Emplearse');
      ws.columns = [{ key: 'r', width: 30 }, { key: 't', width: 15 }, { key: 'p', width: 16 }];
      this.excelTable(ws, ['Rango de Tiempo', 'Egresados', '% del Total'],
        rangos.map(r => [r, totalPorRango[r], +((totalPorRango[r] / totalTiempo) * 100).toFixed(2)]),
        4,
      );
    }

    // Medio de Obtención del Primer Empleo
    {
      const mediosEmpleo = [...(data.medioPrimerEmpleo ?? [])]
        .sort((a: any, b: any) => Number(a.orden) - Number(b.orden));
      const totalMedio = mediosEmpleo.reduce((a, m: any) => a + Number(m.total), 0) || 1;

      const ws = addSheet('Medio Primer Empleo', 3, 'Medio de Obtención del Primer Empleo');
      ws.columns = [{ key: 'm', width: 38 }, { key: 't', width: 15 }, { key: 'p', width: 16 }];
      this.excelTable(ws, ['Medio', 'Egresados', '% del Total'],
        mediosEmpleo.map((m: any) => [m.medio || '—', Number(m.total), +((Number(m.total) / totalMedio) * 100).toFixed(2)]),
        4,
      );
    }

    return this.toBuffer(wb);
  }

  // PÁGINA 3 — Titulación

  async exportarTitulacionPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);

    // Sin título repetido en páginas adicionales
    const onNewPage = () => this.pdfNewPage(doc);

    const k = data.kpis;
    const total = k.total_egresados || 1;

    let y = this.pdfPageHeader(doc, 'Titulación', filtros, fecha);

    // 1) Indicadores de Titulación
    y = this.pdfSection(doc, 'Indicadores de Titulación', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Indicador', 'Valor'],
      [
        ['Total Egresados', String(k.total_egresados)],
        ['Titulados', String(k.titulados)],
        ['En Trámite', String(k.en_tramite)],
        ['No Titulados', String(k.no_titulados)],
        ['% Titulados', `${((k.titulados / total) * 100).toFixed(1)}%`],
        ['% En Trámite', `${((k.en_tramite / total) * 100).toFixed(1)}%`],
        ['% No Titulados', `${((k.no_titulados / total) * 100).toFixed(1)}%`],
      ],
      [260, 160], MARGIN_X, y, onNewPage,
    );

    // 2) Egresados con Posgrado
    if ((data.posgradoPorTipo || []).length > 0) {
      y = this.pdfSection(doc, 'Egresados con Posgrado', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Tipo de Posgrado', 'Total'],
        (data.posgradoPorTipo || []).map((r: any) => [r.tipo_posgrado || '—', String(r.total)]),
        [340, 120], MARGIN_X, y, onNewPage,
      );
    }

    // 3) Estado de Titulación por Carrera
    y = this.pdfSection(doc, 'Estado de Titulación por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Titulados', 'En Trámite', 'No Tit.', '% Tit.'],
      (data.titulacionCarrera || []).map((r: any) => [
        r.nombre_carrera,
        String(r.total),
        String(r.titulados),
        String(r.en_tramite),
        String(r.no_titulados),
        `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
      ]),
      [210, 65, 80, 90, 75, 75], MARGIN_X, y, onNewPage,
      undefined,  // seccionTitulo
      28,         // rowHeight
    );

    // 4) Tendencia de Titulación por Año de Egreso
    y = this.pdfSection(doc, 'Tendencia de Titulación por Año de Egreso', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Año', 'Total', 'Titulados', 'En Trámite', 'No Tit.', '% Tit.'],
      (data.titulacionAnio || [])
        .sort((a: any, b: any) => Number(a.anio_egreso) - Number(b.anio_egreso))
        .map((r: any) => [
          String(r.anio_egreso),
          String(r.total),
          String(r.titulados),
          String(r.en_tramite),
          String(r.no_titulados ?? 0),
          `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
        ]),
      [70, 70, 90, 100, 90, 80], MARGIN_X, y, onNewPage,
    );

    // 5) Detalle por Carrera y Año de Egreso
    if ((data.titulacionCarreraAnio || []).length > 0) {
      y = this.pdfSection(doc, 'Detalle por Carrera y Año de Egreso', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Carrera', 'Año', 'Total', 'Titulados', 'En Trámite', 'No Tit.', '% Tit.'],
        (data.titulacionCarreraAnio || [])
          .sort((a: any, b: any) =>
            a.nombre_carrera.localeCompare(b.nombre_carrera) ||
            Number(a.anio_egreso) - Number(b.anio_egreso),
          )
          .map((r: any) => [
            r.nombre_carrera,
            String(r.anio_egreso),
            String(r.total),
            String(r.titulados),
            String(r.en_tramite),
            String(r.no_titulados ?? 0),
            `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
          ]),
        [190, 55, 60, 80, 90, 75, 75], MARGIN_X, y, onNewPage,
        undefined,
        28,
      );
    }

    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarTitulacionExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticas(carrera, anio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Titulación', filtros, fecha, () => 0);
    const k = data.kpis;
    const total = k.total_egresados || 1;

    // 1) Indicadores de Titulación
    {
      const ws = addSheet('Indicadores', 2, 'Indicadores de Titulación');
      ws.columns = [{ key: 'ind', width: 30 }, { key: 'val', width: 20 }];
      this.excelTable(ws, ['Indicador', 'Valor'], [
        ['Total Egresados', k.total_egresados],
        ['Titulados', k.titulados],
        ['En Trámite', k.en_tramite],
        ['No Titulados', k.no_titulados],
        ['% Titulados', +((k.titulados / total) * 100).toFixed(2)],
        ['% En Trámite', +((k.en_tramite / total) * 100).toFixed(2)],
        ['% No Titulados', +((k.no_titulados / total) * 100).toFixed(2)],
      ], 4);
    }

    // 2) Egresados con Posgrado
    {
      const ws = addSheet('Posgrado', 2, 'Egresados con Posgrado');
      ws.columns = [{ key: 'tipo', width: 34 }, { key: 't', width: 15 }];
      this.excelTable(ws, ['Tipo de Posgrado', 'Total'],
        (data.posgradoPorTipo || []).map((r: any) => [r.tipo_posgrado || '—', r.total]),
        4,
      );
    }

    // 3) Estado de Titulación por Carrera
    {
      const ws = addSheet('Estado por Carrera', 8, 'Estado de Titulación por Carrera');
      ws.columns = [
        { key: 'c', width: 38 },
        { key: 't', width: 10 },
        { key: 'tt', width: 14 },
        { key: 'tr', width: 14 },
        { key: 'nt', width: 16 },
        { key: 'pt', width: 14 },
        { key: 'ptr', width: 14 },
        { key: 'pnt', width: 16 },
      ];
      this.excelTable(
        ws,
        ['Carrera', 'Total', 'Titulados', 'En Trámite', 'No Titulados',
          '% Titulados', '% En Trámite', '% No Titulados'],
        (data.titulacionCarrera || []).map((r: any) => [
          r.nombre_carrera,
          r.total,
          r.titulados,
          r.en_tramite,
          r.no_titulados,
          +(+(r.pct_titulados) || 0).toFixed(2),
          +(+(r.pct_en_tramite) || 0).toFixed(2),
          +(+(r.pct_no_titulados) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 4) Tendencia de Titulación por Año de Egreso
    {
      const ws = addSheet('Tendencia por Año', 6, 'Tendencia de Titulación por Año de Egreso');
      ws.columns = [
        { key: 'a', width: 12 },
        { key: 't', width: 12 },
        { key: 'tt', width: 14 },
        { key: 'tr', width: 14 },
        { key: 'nt', width: 16 },
        { key: 'p', width: 16 },
      ];
      this.excelTable(
        ws,
        ['Año', 'Total', 'Titulados', 'En Trámite', 'No Titulados', '% Titulados'],
        [...(data.titulacionAnio || [])]
          .sort((a: any, b: any) => Number(a.anio_egreso) - Number(b.anio_egreso))
          .map((r: any) => [
            r.anio_egreso,
            r.total,
            r.titulados,
            r.en_tramite,
            r.no_titulados ?? 0,
            +(+(r.pct_titulados) || 0).toFixed(2),
          ]),
        4,
      );
    }

    // 5) Detalle por Carrera y Año de Egreso
    {
      const ws = addSheet('Detalle Carrera–Año', 7, 'Detalle por Carrera y Año de Egreso');
      ws.columns = [
        { key: 'c', width: 38 },
        { key: 'a', width: 12 },
        { key: 't', width: 12 },
        { key: 'tt', width: 14 },
        { key: 'tr', width: 14 },
        { key: 'nt', width: 16 },
        { key: 'p', width: 14 },
      ];
      this.excelTable(
        ws,
        ['Carrera', 'Año', 'Total', 'Titulados', 'En Trámite', 'No Titulados', '% Titulados'],
        [...(data.titulacionCarreraAnio || [])]
          .sort((a: any, b: any) =>
            a.nombre_carrera.localeCompare(b.nombre_carrera) ||
            Number(a.anio_egreso) - Number(b.anio_egreso),
          )
          .map((r: any) => [
            r.nombre_carrera,
            r.anio_egreso,
            r.total,
            r.titulados,
            r.en_tramite,
            r.no_titulados ?? 0,
            +(+(r.pct_titulados) || 0).toFixed(2),
          ]),
        4,
      );
    }

    return this.toBuffer(wb);
  }

  // PÁGINA 4 — Vinculación

  async exportarVinculacionPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const [estadisticas, satisfaccion, colaboraciones, habilidades] = await Promise.all([
      this.egresadosService.getEstadisticas(carrera, anio),
      this.egresadosService.getDistribucionSatisfaccion(carrera, anio),
      this.egresadosService.getTotalesColaboraciones(carrera, anio),
      this.egresadosService.getTotalesHabilidades(carrera, anio),
    ]);
    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);

    const onNewPage = () => this.pdfNewPage(doc);

    const k = estadisticas.kpis;
    const total = k.total_egresados || 1;

    let y = this.pdfPageHeader(doc, 'Vinculación', filtros, fecha);

    // 1) Indicadores Generales
    y = this.pdfSection(doc, 'Indicadores Generales', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Indicador', 'Valor'],
      [
        ['Total Egresados', String(k.total_egresados)],
        ['Autorizó Contacto', String(k.autorizo_contacto)],
        ['Autorizó Eventos', String(k.autorizo_eventos)],
        ['% Autorizó Contacto', `${((k.autorizo_contacto / total) * 100).toFixed(1)}%`],
        ['% Autorizó Eventos', `${((k.autorizo_eventos / total) * 100).toFixed(1)}%`],
        ['Satisfacción Promedio', `${(+(k.satisfaccion_promedio) || 0).toFixed(2)} / 5`],
      ],
      [280, 160], MARGIN_X, y, onNewPage,
    );

    // 2) Satisfacción con la Formación — ITD
    y = this.pdfSection(doc, 'Satisfacción con la Formación — ITD', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Nivel (1-5)', 'Total', '%'],
      (satisfaccion || [])
        .sort((a: any, b: any) => Number(b.nivel) - Number(a.nivel))
        .map((r: any) => {
          const pct = total > 0 ? ((+r.total / total) * 100).toFixed(1) : '0';
          return [String(r.nivel), String(r.total), `${pct}%`];
        }),
      [120, 100, 100], MARGIN_X, y, onNewPage,
    );

    // 3) Interés en Colaborar
    y = this.pdfSection(doc, 'Interés en Colaborar', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Tipo de Colaboración', 'Total'],
      (colaboraciones || []).map((r: any) => [r.descripcion || '—', String(r.total)]),
      [380, 100], MARGIN_X, y, onNewPage,
    );

    // 4) Autorización de Datos
    y = this.pdfSection(doc, 'Autorización de Datos', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Tipo', 'Total', '%'],
      [
        ['Autorizó Contacto', String(k.autorizo_contacto), `${((k.autorizo_contacto / total) * 100).toFixed(1)}%`],
        ['No autorizó Contacto', String(k.total_egresados - k.autorizo_contacto), `${(((k.total_egresados - k.autorizo_contacto) / total) * 100).toFixed(1)}%`],
        ['Autorizó Eventos', String(k.autorizo_eventos), `${((k.autorizo_eventos / total) * 100).toFixed(1)}%`],
        ['No autorizó Eventos', String(k.total_egresados - k.autorizo_eventos), `${(((k.total_egresados - k.autorizo_eventos) / total) * 100).toFixed(1)}%`],
      ],
      [260, 100, 100], MARGIN_X, y, onNewPage,
    );

    // 5) Habilidades a Reforzar
    y = this.pdfSection(doc, 'Habilidades a Reforzar', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Habilidad', 'Total'],
      (habilidades || []).map((r: any) => [r.habilidad || '—', String(r.total)]),
      [380, 100], MARGIN_X, y, onNewPage,
    );

    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarVinculacionPanelPdf(
    seccion: 'colab' | 'hab' | 'auth',
    valor: string,
    titulo: string,
    carrera?: string,
    anio?: number,
  ): Promise<Buffer> {
    // Obtener los egresados según la sección
    let egresados: any[] = [];

    if (seccion === 'colab') {
      if (valor === 'Otro') {
        egresados = await this.egresadosService.getEgresadosColaboracionOtro(carrera, anio);
      } else {
        egresados = await this.egresadosService.getEgresadosPorColaboracion(valor, carrera, anio);
      }
    } else if (seccion === 'hab') {
      if (valor === 'Otro') {
        egresados = await this.egresadosService.getEgresadosHabilidadOtro(carrera, anio);
      } else {
        egresados = await this.egresadosService.getEgresadosPorHabilidad(valor, carrera, anio);
      }
    } else if (seccion === 'auth') {
      egresados = await this.egresadosService.getEgresadosPorAutorizacion(
        valor as 'estadisticas' | 'contacto' | 'eventos',
        carrera,
        anio,
      );
    }

    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPage(doc);

    let y = this.pdfPageHeader(doc, titulo, filtros, fecha);

    // Tabla de egresados
    y = this.pdfSection(doc, `${egresados.length} egresado(s) encontrado(s)`, y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Nombre', 'Carrera', 'Correo', 'Teléfono'],
      egresados.map((e: any) => [
        e.nombre_completo || '—',
        e.nombre_carrera || '—',
        e.correo || '—',
        e.telefono || '—',
      ]),
      [160, 140, 140, 100], MARGIN_X, y, onNewPage,
    );

    // Si es "Otro", mostrar también la descripción libre
    const tieneDescripcion = egresados.some((e: any) => e.descripcion_otro);
    if (tieneDescripcion) {
      y = this.pdfSection(doc, 'Respuestas libres', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Nombre', 'Descripción'],
        egresados
          .filter((e: any) => e.descripcion_otro)
          .map((e: any) => [e.nombre_completo || '—', e.descripcion_otro || '—']),
        [160, 320], MARGIN_X, y, onNewPage,
      );
    }

    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarVinculacionExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const [estadisticas, satisfaccion, colaboraciones, habilidades] = await Promise.all([
      this.egresadosService.getEstadisticas(carrera, anio),
      this.egresadosService.getDistribucionSatisfaccion(carrera, anio),
      this.egresadosService.getTotalesColaboraciones(carrera, anio),
      this.egresadosService.getTotalesHabilidades(carrera, anio),
    ]);

    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const k = estadisticas.kpis;
    const total = k.total_egresados || 1;

    const { wb, addSheet } = this.makeWorkbook('Vinculación', filtros, fecha, () => 0);

    // 1) Indicadores Generales
    {
      const ws = addSheet('Indicadores', 2, 'Indicadores Generales');
      ws.columns = [{ key: 'indicador', width: 35 }, { key: 'valor', width: 20 }];
      this.excelTable(
        ws,
        ['Indicador', 'Valor'],
        [
          ['Total Egresados', String(k.total_egresados)],
          ['Autorizó Contacto', String(k.autorizo_contacto)],
          ['Autorizó Eventos', String(k.autorizo_eventos)],
          ['% Autorizó Contacto', `${((k.autorizo_contacto / total) * 100).toFixed(1)}%`],
          ['% Autorizó Eventos', `${((k.autorizo_eventos / total) * 100).toFixed(1)}%`],
          ['Satisfacción Promedio', `${(+(k.satisfaccion_promedio) || 0).toFixed(2)} / 5`],
        ],
        4,
      );
    }

    // 2) Satisfacción con la Formación
    {
      const ws = addSheet('Satisfacción', 2, 'Satisfacción con la Formación — ITD');
      ws.columns = [
        { key: 'nivel', width: 42 },
        { key: 'total', width: 15 },
        { key: 'pct', width: 15 },
      ];
      this.excelTable(
        ws,
        ['Nivel (1-5)', 'Total', '%'],
        (satisfaccion || [])
          .sort((a: any, b: any) => Number(b.nivel) - Number(a.nivel))
          .map((r: any) => {
            const pct = total > 0 ? ((+r.total / total) * 100).toFixed(1) : '0';
            return [String(r.nivel), String(r.total), `${pct}%`];
          }),
        4,
      );
    }

    // 3) Interés en Colaborar
    {
      const ws = addSheet('Colaboraciones', 2, 'Interés en Colaborar');
      ws.columns = [{ key: 'tipo', width: 45 }, { key: 'total', width: 15 }];
      this.excelTable(
        ws,
        ['Tipo de Colaboración', 'Total'],
        (colaboraciones || []).map((r: any) => [r.descripcion || '—', String(r.total)]),
        4,
      );
    }

    // 4) Autorización de Datos
    {
      const ws = addSheet('Autorización', 2, 'Autorización de Datos');
      ws.columns = [
        { key: 'tipo', width: 42 },
        { key: 'total', width: 15 },
        { key: 'pct', width: 15 },
      ];
      this.excelTable(
        ws,
        ['Tipo', 'Total', '%'],
        [
          ['Autorizó Contacto', String(k.autorizo_contacto), `${((k.autorizo_contacto / total) * 100).toFixed(1)}%`],
          ['No autorizó Contacto', String(k.total_egresados - k.autorizo_contacto), `${(((k.total_egresados - k.autorizo_contacto) / total) * 100).toFixed(1)}%`],
          ['Autorizó Eventos', String(k.autorizo_eventos), `${((k.autorizo_eventos / total) * 100).toFixed(1)}%`],
          ['No autorizó Eventos', String(k.total_egresados - k.autorizo_eventos), `${(((k.total_egresados - k.autorizo_eventos) / total) * 100).toFixed(1)}%`],
        ],
        4,
      );
    }

    // 5) Habilidades a Reforzar
    {
      const ws = addSheet('Habilidades', 2, 'Habilidades a Reforzar');
      ws.columns = [{ key: 'habilidad', width: 45 }, { key: 'total', width: 15 }];
      this.excelTable(
        ws,
        ['Habilidad', 'Total'],
        (habilidades || []).map((r: any) => [r.habilidad || '—', String(r.total)]),
        4,
      );
    }

    return this.toBuffer(wb);
  }

  async exportarVinculacionPanelExcel(
    seccion: 'colab' | 'hab' | 'auth',
    valor: string,
    titulo: string,
    carrera?: string,
    anio?: number,
  ): Promise<Buffer> {
    let egresados: any[] = [];

    if (seccion === 'colab') {
      egresados = valor === 'Otro'
        ? await this.egresadosService.getEgresadosColaboracionOtro(carrera, anio)
        : await this.egresadosService.getEgresadosPorColaboracion(valor, carrera, anio);
    } else if (seccion === 'hab') {
      egresados = valor === 'Otro'
        ? await this.egresadosService.getEgresadosHabilidadOtro(carrera, anio)
        : await this.egresadosService.getEgresadosPorHabilidad(valor, carrera, anio);
    } else if (seccion === 'auth') {
      egresados = await this.egresadosService.getEgresadosPorAutorizacion(
        valor as 'estadisticas' | 'contacto' | 'eventos', carrera, anio,
      );
    }

    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook(titulo, filtros, fecha, () => 0);

    const ws = addSheet('Egresados', 2, titulo);
    ws.columns = [
      { key: 'nombre', width: 35 },
      { key: 'carrera', width: 40 },
      { key: 'correo', width: 35 },
      { key: 'tel', width: 18 },
      // Solo aparece si hay respuestas libres (Otro)
      ...(egresados.some((e: any) => e.descripcion_otro)
        ? [{ key: 'desc', width: 45 }]
        : []),
    ];

    const headers = ['Nombre', 'Carrera', 'Correo', 'Teléfono'];
    if (egresados.some((e: any) => e.descripcion_otro)) headers.push('Descripción libre');

    this.excelTable(
      ws,
      headers,
      egresados.map((e: any) => {
        const row = [
          e.nombre_completo || '—',
          e.nombre_carrera || '—',
          e.correo || '—',
          e.telefono || '—',
        ];
        if (egresados.some((x: any) => x.descripcion_otro)) {
          row.push(e.descripcion_otro || '');
        }
        return row;
      }),
      4,
    );

    return this.toBuffer(wb);
  }

  // PÁGINA 5 — Comparativas

  async exportarComparativasPdf(carreras: string[]): Promise<Buffer> {
    const data = await this.egresadosService.getComparativas(carreras);
    const fecha = this.fechaStr();
    const filtros = `Carreras: ${carreras.join(', ')}`;
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPage(doc);

    let y = this.pdfPageHeader(doc, 'Comparativas entre Carreras', filtros, fecha);

    // ── TABLA 1 — Resumen por Carrera ─────────────────────────────────────────
    // Fuente: data.resumen  →  campos reales del servicio
    y = this.pdfSection(doc, 'Resumen por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', '% Emp.', '% Tit.', 'Satisf.', '% F.Dgo.'],
      (data.resumen || []).map((r: any) => [
        r.nombre_carrera,
        String(r.total),
        `${(+(r.pct_empleados) || 0).toFixed(1)}%`,
        `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
        (+(r.satisfaccion_promedio) || 0).toFixed(2),
        `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`,
      ]),
      [200, 60, 70, 70, 75, 85],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 2 — Perfil Comparativo ──────────────────────────────────────────
    // Construido desde data.resumen (mismos campos disponibles) +
    // inglés avanzado pivoteado desde data.ingles
    const inglesAvanzadoMap: Record<string, number> = {};
    for (const r of (data.ingles || [])) {
      if (String(r.nivel).toLowerCase().includes('avanz')) {
        inglesAvanzadoMap[r.nombre_carrera] =
          (inglesAvanzadoMap[r.nombre_carrera] || 0) + Number(r.total);
      }
    }
    const totalPorCarrera: Record<string, number> = {};
    for (const r of (data.resumen || [])) {
      totalPorCarrera[r.nombre_carrera] = Number(r.total);
    }

    y = this.pdfSection(doc, 'Perfil Comparativo', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', '% Emp.', '% Tit.', '% Inglés Av.', '% F.Dgo.', 'Satisf.'],
      (data.resumen || []).map((r: any) => {
        const avanzado = inglesAvanzadoMap[r.nombre_carrera] || 0;
        const tot = totalPorCarrera[r.nombre_carrera] || 1;
        return [
          r.nombre_carrera,
          `${(+(r.pct_empleados) || 0).toFixed(1)}%`,
          `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
          `${((avanzado / tot) * 100).toFixed(1)}%`,
          `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`,
          (+(r.satisfaccion_promedio) || 0).toFixed(2),
        ];
      }),
      [195, 68, 68, 90, 78, 65],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 3 — Heatmap de Indicadores ─────────────────────────────────────
    // Misma fuente que Tabla 2, mismos campos
    y = this.pdfSection(doc, 'Heatmap de Indicadores', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Empleo', 'Titulación', 'Inglés Av.', 'Migración', 'Satisfacción'],
      (data.resumen || []).map((r: any) => {
        const avanzado = inglesAvanzadoMap[r.nombre_carrera] || 0;
        const tot = totalPorCarrera[r.nombre_carrera] || 1;
        return [
          r.nombre_carrera,
          `${(+(r.pct_empleados) || 0).toFixed(1)}%`,
          `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
          `${((avanzado / tot) * 100).toFixed(1)}%`,
          `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`,
          (+(r.satisfaccion_promedio) || 0).toFixed(2),
        ];
      }),
      [195, 68, 82, 82, 82, 90],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 4 — ¿Cuántos están Empleados? ──────────────────────────────────
    // Fuente: data.empleo
    y = this.pdfSection(doc, '¿Cuántos están Empleados?', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Empleados', '% Empleados'],
      (data.empleo || []).map((r: any) => [
        r.nombre_carrera,
        String(r.total),
        String(r.empleados),
        `${(+(r.pct_empleados) || 0).toFixed(1)}%`,
      ]),
      [260, 80, 100, 110],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 5 — Comparativa Empleados vs Desempleados ──────────────────────
    // Fuente: data.empleo  — pct_desempleados se calcula (no viene del servicio)
    y = this.pdfSection(doc, 'Comparativa Empleados vs Desempleados', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Empleados', 'Desempl.', '% Emp.', '% Desemp.'],
      (data.empleo || []).map((r: any) => {
        const tot = +(r.total) || 1;
        const desemp = +(r.desempleados) || 0;
        return [
          r.nombre_carrera,
          String(r.total),
          String(r.empleados),
          String(r.desempleados),
          `${(+(r.pct_empleados) || 0).toFixed(1)}%`,
          `${((desemp / tot) * 100).toFixed(1)}%`,  // calculado en frontend
        ];
      }),
      [190, 55, 80, 75, 72, 80],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 6 — Titulado / En Trámite / No Titulado por Carrera ────────────
    // Fuente: data.titulacion
    y = this.pdfSection(doc, 'Titulado / En Trámite / No Titulado por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Titulados', 'Trámite', 'No Tit.', '% Tit.'],
      (data.titulacion || []).map((r: any) => [
        r.nombre_carrera,
        String(r.total),
        String(r.titulados),
        String(r.en_tramite),
        String(r.no_titulados),
        `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
      ]),
      [200, 55, 80, 75, 75, 75],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 7 — Detalle Numérico ────────────────────────────────────────────
    // Construido combinando data.empleo + data.titulacion + data.migracion
    // (no existe data.detalle_numerico en el servicio)
    const empleoMap: Record<string, any> = {};
    const titulacMap: Record<string, any> = {};
    const migracionMap: Record<string, any> = {};
    for (const r of (data.empleo || [])) empleoMap[r.nombre_carrera] = r;
    for (const r of (data.titulacion || [])) titulacMap[r.nombre_carrera] = r;
    for (const r of (data.migracion || [])) migracionMap[r.nombre_carrera] = r;

    y = this.pdfSection(doc, 'Detalle Numérico', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Emp.', 'Desemp.', 'Tit.', 'Trám.', 'No Tit.', 'F.Dgo.'],
      (data.resumen || []).map((r: any) => {
        const e = empleoMap[r.nombre_carrera] || {};
        const t = titulacMap[r.nombre_carrera] || {};
        const m = migracionMap[r.nombre_carrera] || {};
        return [
          r.nombre_carrera,
          String(r.total),
          String(e.empleados ?? '-'),
          String(e.desempleados ?? '-'),
          String(t.titulados ?? '-'),
          String(t.en_tramite ?? '-'),
          String(t.no_titulados ?? '-'),
          String(m.fuera_durango_mexico ?? '-'),
        ];
      }),
      [165, 45, 50, 60, 45, 50, 60, 60],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 8 — Sector Laboral por Carrera ─────────────────────────────────
    // Fuente: data.sectorCarrera  ← key real del servicio (no sector_por_carrera)
    // Campos reales: nombre_carrera, sector, total, porcentaje
    y = this.pdfSection(doc, 'Sector Laboral por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Sector', 'Cantidad', '%'],
      (data.sectorCarrera || []).map((r: any) => [
        r.nombre_carrera,
        r.sector,
        String(r.total),                             // campo real: total
        `${(+(r.porcentaje) || 0).toFixed(1)}%`,     // campo real: porcentaje
      ]),
      [200, 190, 75, 70],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 9 — Desglose por Sector y Carrera ───────────────────────────────
    // Construido desde data.sectorCarrera reorganizando el eje
    // (el servicio no devuelve pct_en_sector, se calcula)
    const sectorTotales: Record<string, number> = {};
    for (const r of (data.sectorCarrera || [])) {
      sectorTotales[r.sector] = (sectorTotales[r.sector] || 0) + Number(r.total);
    }

    y = this.pdfSection(doc, 'Desglose por Sector y Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Sector', 'Carrera', 'Cantidad', '% en Sector', '% en Carrera'],
      [...(data.sectorCarrera || [])]
        .sort((a: any, b: any) => a.sector.localeCompare(b.sector))
        .map((r: any) => {
          const totSector = sectorTotales[r.sector] || 1;
          return [
            r.sector,
            r.nombre_carrera,
            String(r.total),
            `${((Number(r.total) / totSector) * 100).toFixed(1)}%`,
            `${(+(r.porcentaje) || 0).toFixed(1)}%`,  // % dentro de su carrera
          ];
        }),
      [155, 180, 65, 90, 95],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 10 — Nivel de Inglés por Carrera ────────────────────────────────
    // Fuente: data.ingles  → filas por nivel·carrera → se pivotea aquí
    // Campos reales: nombre_carrera, nivel, total, porcentaje
    const inglesMap: Record<string, Record<string, number>> = {};
    const inglesTotal: Record<string, number> = {};
    for (const r of (data.ingles || [])) {
      if (!inglesMap[r.nombre_carrera]) inglesMap[r.nombre_carrera] = {};
      inglesMap[r.nombre_carrera][String(r.nivel).toLowerCase()] = Number(r.total);
      inglesTotal[r.nombre_carrera] = (inglesTotal[r.nombre_carrera] || 0) + Number(r.total);
    }

    y = this.pdfSection(doc, 'Nivel de Inglés por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Básico', 'Intermedio', 'Avanzado', 'Total', '% Avanzado'],
      (data.resumen || []).map((r: any) => {
        const niveles = inglesMap[r.nombre_carrera] || {};
        const tot = inglesTotal[r.nombre_carrera] || 0;
        const basico = niveles['básico'] ?? niveles['basico'] ?? 0;
        const inter = niveles['intermedio'] ?? 0;
        const avanzado = niveles['avanzado'] ?? 0;
        return [
          r.nombre_carrera,
          String(basico),
          String(inter),
          String(avanzado),
          String(tot),
          `${tot > 0 ? ((avanzado / tot) * 100).toFixed(1) : '0.0'}%`,
        ];
      }),
      [195, 62, 88, 82, 52, 90],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 11 — Migración: ¿Qué Carrera Emigra Más? ───────────────────────
    // Fuente: data.migracion  → campos reales del servicio
    y = this.pdfSection(doc, 'Migración — ¿Qué Carrera Emigra Más?', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'En Dgo.', 'F.Dgo. MX', 'Extranjero', '% F.Dgo.', '% Ext.'],
      (data.migracion || []).map((r: any) => [
        r.nombre_carrera,
        String(r.en_durango),
        String(r.fuera_durango_mexico),
        String(r.en_extranjero),
        `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`,
        `${(+(r.pct_extranjero) || 0).toFixed(1)}%`,
      ]),
      [190, 62, 82, 85, 80, 65],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 12 — Satisfacción de Formación Académica ───────────────────────
    // Fuente: data.satisfaccion  → campo promedio (no satisfaccion_promedio)
    y = this.pdfSection(doc, 'Satisfacción de Formación Académica', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Muy Sat.', 'Satisfecho', 'Neutral', 'Insatisf.', 'Promedio'],
      (data.satisfaccion || []).map((r: any) => [
        r.nombre_carrera,
        String(r.total),
        String(r.muy_satisfecho),
        String(r.satisfecho),
        String(r.neutral),
        String(r.insatisfecho),
        (+(r.promedio) || 0).toFixed(2),   // ← campo real: promedio, no satisfaccion_promedio
      ]),
      [165, 45, 65, 78, 62, 65, 75],
      MARGIN_X, y, onNewPage,
    );

    // ── TABLA 13 — Comparativa Visual (Ranking Consolidado) ──────────────────
    // Construido desde data.resumen + inglés avanzado calculado arriba
    // Score = promedio simple de los 5 indicadores normalizados a 0–100
    y = this.pdfSection(doc, 'Comparativa Visual — Ranking Consolidado', y, onNewPage);
    this.pdfTable(
      doc,
      ['#', 'Carrera', '% Emp.', '% Tit.', '% Inglés', '% F.Dgo.', 'Satisf.', 'Score'],
      (data.resumen || [])
        .map((r: any) => {
          const avanzado = inglesAvanzadoMap[r.nombre_carrera] || 0;
          const tot = totalPorCarrera[r.nombre_carrera] || 1;
          const pctIngles = (avanzado / tot) * 100;
          const emp = +(r.pct_empleados) || 0;
          const tit = +(r.pct_titulados) || 0;
          const migr = +(r.pct_fuera_durango) || 0;
          const satisf = (+(r.satisfaccion_promedio) || 0) * 20; // escala 1-5 → 0-100
          const score = ((emp + tit + pctIngles + migr + satisf) / 5).toFixed(2);
          return { r, emp, tit, pctIngles, migr, satisf: +(r.satisfaccion_promedio) || 0, score };
        })
        .sort((a: any, b: any) => +b.score - +a.score)
        .map((item: any, i: number) => [
          String(i + 1),
          item.r.nombre_carrera,
          `${item.emp.toFixed(1)}%`,
          `${item.tit.toFixed(1)}%`,
          `${item.pctIngles.toFixed(1)}%`,
          `${item.migr.toFixed(1)}%`,
          item.satisf.toFixed(2),
          item.score,
        ]),
      [25, 165, 55, 50, 62, 58, 58, 57],
      MARGIN_X, y, onNewPage,
    );

    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarComparativasExcel(carreras: string[]): Promise<Buffer> {
    const data = await this.egresadosService.getComparativas(carreras);
    const fecha = this.fechaStr();
    const filtros = `Carreras: ${carreras.join(', ')}`;
    const { wb, addSheet } = this.makeWorkbook('Comparativas', filtros, fecha, () => 0);

    // Precalcular inglés avanzado (igual que en PDF)
    const inglesAvanzadoMap: Record<string, number> = {};
    for (const r of (data.ingles || [])) {
      if (String(r.nivel).toLowerCase().includes('avanz')) {
        inglesAvanzadoMap[r.nombre_carrera] =
          (inglesAvanzadoMap[r.nombre_carrera] || 0) + Number(r.total);
      }
    }
    const totalPorCarrera: Record<string, number> = {};
    for (const r of (data.resumen || [])) {
      totalPorCarrera[r.nombre_carrera] = Number(r.total);
    }

    // Maps para Detalle Numérico (T7)
    const empleoMap: Record<string, any> = {};
    const titulacMap: Record<string, any> = {};
    const migracionMap: Record<string, any> = {};
    for (const r of (data.empleo || [])) empleoMap[r.nombre_carrera] = r;
    for (const r of (data.titulacion || [])) titulacMap[r.nombre_carrera] = r;
    for (const r of (data.migracion || [])) migracionMap[r.nombre_carrera] = r;

    // Totales por sector para Desglose (T9)
    const sectorTotales: Record<string, number> = {};
    for (const r of (data.sectorCarrera || [])) {
      sectorTotales[r.sector] = (sectorTotales[r.sector] || 0) + Number(r.total);
    }

    // Pivot inglés para T10
    const inglesMap: Record<string, Record<string, number>> = {};
    const inglesTotalMap: Record<string, number> = {};
    for (const r of (data.ingles || [])) {
      if (!inglesMap[r.nombre_carrera]) inglesMap[r.nombre_carrera] = {};
      inglesMap[r.nombre_carrera][String(r.nivel).toLowerCase()] = Number(r.total);
      inglesTotalMap[r.nombre_carrera] = (inglesTotalMap[r.nombre_carrera] || 0) + Number(r.total);
    }

    // ── HOJA 1 — Resumen por Carrera ─────────────────────────────────────────
    {
      const ws = addSheet('Resumen', 6, 'Resumen por Carrera');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 't', width: 12 },
        { key: 'pe', width: 16 }, { key: 'pt', width: 16 },
        { key: 's', width: 16 }, { key: 'pd', width: 18 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Total', '% Empleados', '% Titulados', 'Satisfacción', '% Fuera Durango'],
        (data.resumen || []).map((r: any) => [
          r.nombre_carrera, r.total, r.pct_empleados,
          r.pct_titulados, r.satisfaccion_promedio, r.pct_fuera_durango,
        ]), 4);
    }

    // ── HOJA 2 — Perfil Comparativo ──────────────────────────────────────────
    {
      const ws = addSheet('Perfil Comparativo', 6, 'Perfil Comparativo');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 'pe', width: 16 },
        { key: 'pt', width: 16 }, { key: 'pi', width: 18 },
        { key: 'pd', width: 18 }, { key: 's', width: 16 },
      ];
      this.excelTable(ws,
        ['Carrera', '% Empleados', '% Titulados', '% Inglés Av.', '% Fuera Dgo.', 'Satisfacción'],
        (data.resumen || []).map((r: any) => {
          const avanzado = inglesAvanzadoMap[r.nombre_carrera] || 0;
          const tot = totalPorCarrera[r.nombre_carrera] || 1;
          return [
            r.nombre_carrera,
            +(+(r.pct_empleados) || 0).toFixed(1),
            +(+(r.pct_titulados) || 0).toFixed(1),
            +((avanzado / tot) * 100).toFixed(1),
            +(+(r.pct_fuera_durango) || 0).toFixed(1),
            +(+(r.satisfaccion_promedio) || 0).toFixed(2),
          ];
        }), 4);
    }

    // ── HOJA 3 — Heatmap de Indicadores ──────────────────────────────────────
    {
      const ws = addSheet('Heatmap', 6, 'Heatmap de Indicadores');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 'emp', width: 16 },
        { key: 'tit', width: 16 }, { key: 'ing', width: 18 },
        { key: 'mig', width: 18 }, { key: 'sat', width: 16 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Empleo (%)', 'Titulación (%)', 'Inglés Av. (%)', 'Migración (%)', 'Satisfacción'],
        (data.resumen || []).map((r: any) => {
          const avanzado = inglesAvanzadoMap[r.nombre_carrera] || 0;
          const tot = totalPorCarrera[r.nombre_carrera] || 1;
          return [
            r.nombre_carrera,
            +(+(r.pct_empleados) || 0).toFixed(1),
            +(+(r.pct_titulados) || 0).toFixed(1),
            +((avanzado / tot) * 100).toFixed(1),
            +(+(r.pct_fuera_durango) || 0).toFixed(1),
            +(+(r.satisfaccion_promedio) || 0).toFixed(2),
          ];
        }), 4);
    }

    // ── HOJA 4 — ¿Cuántos están Empleados? ───────────────────────────────────
    {
      const ws = addSheet('Empleados', 4, '¿Cuántos están Empleados?');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 't', width: 12 },
        { key: 'e', width: 14 }, { key: 'p', width: 16 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Total', 'Empleados', '% Empleados'],
        (data.empleo || []).map((r: any) => [
          r.nombre_carrera, r.total, r.empleados, r.pct_empleados,
        ]), 4);
    }

    // ── HOJA 5 — Comparativa Empleados vs Desempleados ───────────────────────
    {
      const ws = addSheet('Emp. vs Desemp.', 6, 'Comparativa Empleados vs Desempleados');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 't', width: 12 },
        { key: 'e', width: 14 }, { key: 'd', width: 16 },
        { key: 'pe', width: 16 }, { key: 'pd', width: 16 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Total', 'Empleados', 'Desempleados', '% Empleados', '% Desempleados'],
        (data.empleo || []).map((r: any) => {
          const tot = +(r.total) || 1;
          const desemp = +(r.desempleados) || 0;
          return [
            r.nombre_carrera, r.total, r.empleados, r.desempleados,
            +(+(r.pct_empleados) || 0).toFixed(1),
            +((desemp / tot) * 100).toFixed(1),
          ];
        }), 4);
    }

    // ── HOJA 6 — Titulado / En Trámite / No Titulado ─────────────────────────
    {
      const ws = addSheet('Titulación', 8, 'Titulado / En Trámite / No Titulado por Carrera');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 't', width: 10 },
        { key: 'tt', width: 14 }, { key: 'tr', width: 14 },
        { key: 'nt', width: 16 }, { key: 'pt', width: 14 },
        { key: 'ptr', width: 12 }, { key: 'pnt', width: 14 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Total', 'Titulados', 'En Trámite', 'No Titulados',
          '% Titulados', '% Trámite', '% No Titulados'],
        (data.titulacion || []).map((r: any) => [
          r.nombre_carrera, r.total, r.titulados, r.en_tramite, r.no_titulados,
          r.pct_titulados, r.pct_en_tramite, r.pct_no_titulados,
        ]), 4);
    }

    // ── HOJA 7 — Detalle Numérico ─────────────────────────────────────────────
    {
      const ws = addSheet('Detalle Numérico', 8, 'Detalle Numérico Consolidado');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 't', width: 10 },
        { key: 'e', width: 12 }, { key: 'd', width: 14 },
        { key: 'tt', width: 12 }, { key: 'tr', width: 12 },
        { key: 'nt', width: 14 }, { key: 'fd', width: 16 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Total', 'Emp.', 'Desemp.', 'Titulados', 'Trámite', 'No Tit.', 'Fuera Dgo.'],
        (data.resumen || []).map((r: any) => {
          const e = empleoMap[r.nombre_carrera] || {};
          const t = titulacMap[r.nombre_carrera] || {};
          const m = migracionMap[r.nombre_carrera] || {};
          return [
            r.nombre_carrera, r.total,
            e.empleados ?? null,
            e.desempleados ?? null,
            t.titulados ?? null,
            t.en_tramite ?? null,
            t.no_titulados ?? null,
            m.fuera_durango_mexico ?? null,
          ];
        }), 4);
    }

    // ── HOJA 8 — Sector Laboral por Carrera ──────────────────────────────────
    {
      const ws = addSheet('Sector Laboral', 4, 'Sector Laboral por Carrera');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 's', width: 25 },
        { key: 't', width: 12 }, { key: 'p', width: 14 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Sector', 'Total', 'Porcentaje (%)'],
        (data.sectorCarrera || []).map((r: any) => [
          r.nombre_carrera, r.sector, r.total, r.porcentaje,
        ]), 4);
    }

    // ── HOJA 9 — Desglose por Sector y Carrera ───────────────────────────────
    {
      const ws = addSheet('Desglose Sector', 5, 'Desglose por Sector y Carrera');
      ws.columns = [
        { key: 's', width: 25 }, { key: 'c', width: 35 },
        { key: 't', width: 12 }, { key: 'ps', width: 16 },
        { key: 'pc', width: 16 },
      ];
      this.excelTable(ws,
        ['Sector', 'Carrera', 'Cantidad', '% en Sector', '% en Carrera'],
        [...(data.sectorCarrera || [])]
          .sort((a: any, b: any) => a.sector.localeCompare(b.sector))
          .map((r: any) => {
            const totSector = sectorTotales[r.sector] || 1;
            return [
              r.sector, r.nombre_carrera, r.total,
              +((Number(r.total) / totSector) * 100).toFixed(1),
              +(+(r.porcentaje) || 0).toFixed(1),
            ];
          }), 4);
    }

    // ── HOJA 10 — Nivel de Inglés por Carrera ────────────────────────────────
    {
      const ws = addSheet('Inglés Pivote', 6, 'Nivel de Inglés por Carrera');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 'b', width: 14 },
        { key: 'i', width: 16 }, { key: 'a', width: 14 },
        { key: 't', width: 12 }, { key: 'pa', width: 16 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Básico', 'Intermedio', 'Avanzado', 'Total', '% Avanzado'],
        (data.resumen || []).map((r: any) => {
          const niveles = inglesMap[r.nombre_carrera] || {};
          const tot = inglesTotalMap[r.nombre_carrera] || 0;
          const basico = niveles['básico'] ?? niveles['basico'] ?? 0;
          const inter = niveles['intermedio'] ?? 0;
          const avanzado = niveles['avanzado'] ?? 0;
          return [
            r.nombre_carrera, basico, inter, avanzado, tot,
            tot > 0 ? +((avanzado / tot) * 100).toFixed(1) : 0,
          ];
        }), 4);
    }

    // ── HOJA 11 — Migración ───────────────────────────────────────────────────
    {
      const ws = addSheet('Migración', 7, 'Migración — ¿Qué Carrera Emigra Más?');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 't', width: 10 },
        { key: 'ed', width: 16 }, { key: 'fd', width: 18 },
        { key: 'ex', width: 16 }, { key: 'pfd', width: 16 },
        { key: 'pex', width: 16 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Total', 'En Durango', 'Fuera Dgo. MX', 'Extranjero', '% Fuera Dgo.', '% Extranjero'],
        (data.migracion || []).map((r: any) => [
          r.nombre_carrera, r.total, r.en_durango,
          r.fuera_durango_mexico, r.en_extranjero,
          r.pct_fuera_durango, r.pct_extranjero,
        ]), 4);
    }

    // ── HOJA 12 — Satisfacción de Formación Académica ────────────────────────
    {
      const ws = addSheet('Satisfacción', 8, 'Satisfacción de Formación Académica');
      ws.columns = [
        { key: 'c', width: 35 }, { key: 't', width: 10 },
        { key: 'ms', width: 16 }, { key: 's', width: 14 },
        { key: 'n', width: 12 }, { key: 'i', width: 14 },
        { key: 'mi', width: 18 }, { key: 'pr', width: 14 },
      ];
      this.excelTable(ws,
        ['Carrera', 'Total', 'Muy Satisfecho', 'Satisfecho', 'Neutral',
          'Insatisfecho', 'Muy Insatisfecho', 'Promedio'],
        (data.satisfaccion || []).map((r: any) => [
          r.nombre_carrera, r.total, r.muy_satisfecho, r.satisfecho,
          r.neutral, r.insatisfecho, r.muy_insatisfecho,
          +(+(r.promedio) || 0).toFixed(2),
        ]), 4);
    }

    // ── HOJA 13 — Ranking Consolidado ────────────────────────────────────────
    {
      const ws = addSheet('Ranking', 8, 'Comparativa Visual — Ranking Consolidado');
      ws.columns = [
        { key: 'rk', width: 6 }, { key: 'c', width: 35 },
        { key: 'pe', width: 14 }, { key: 'pt', width: 14 },
        { key: 'pi', width: 16 }, { key: 'pm', width: 16 },
        { key: 's', width: 14 }, { key: 'sc', width: 14 },
      ];
      this.excelTable(ws,
        ['#', 'Carrera', '% Emp.', '% Tit.', '% Inglés Av.', '% Migración', 'Satisf.', 'Score'],
        (data.resumen || [])
          .map((r: any) => {
            const avanzado = inglesAvanzadoMap[r.nombre_carrera] || 0;
            const tot = totalPorCarrera[r.nombre_carrera] || 1;
            const pctIngles = (avanzado / tot) * 100;
            const emp = +(r.pct_empleados) || 0;
            const tit = +(r.pct_titulados) || 0;
            const migr = +(r.pct_fuera_durango) || 0;
            const satisfPct = (+(r.satisfaccion_promedio) || 0) * 20;
            const score = +((emp + tit + pctIngles + migr + satisfPct) / 5).toFixed(2);
            return { r, emp, tit, pctIngles, migr, satisf: +(r.satisfaccion_promedio) || 0, score };
          })
          .sort((a: any, b: any) => b.score - a.score)
          .map((item: any, i: number) => [
            i + 1,
            item.r.nombre_carrera,
            +item.emp.toFixed(1),
            +item.tit.toFixed(1),
            +item.pctIngles.toFixed(1),
            +item.migr.toFixed(1),
            +item.satisf.toFixed(2),
            item.score,
          ]), 4);
    }

    return this.toBuffer(wb);
  }

  // PÁGINA 6 — Distribución Geográfica

  async exportarGeografiaPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getDistribucionGeografica(carrera, anio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);

    const onNewPage = () => this.pdfNewPage(doc);

    const k = data.kpisGeo;

    let y = this.pdfPageHeader(doc, 'Distribución Geográfica', filtros, fecha);

    // 1) Indicadores Geográficos
    y = this.pdfSection(doc, 'Indicadores Geográficos', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Indicador', 'Valor'],
      [
        ['Total Mapeados', String(k.total_mapeados)],
        ['Con Ciudad de Trabajo', String(k.con_ciudad_trabajo)],
        ['En Extranjero', String(k.en_extranjero)],
        ['Países Distintos', String(k.paises_distintos)],
        ['Ciudades de Trabajo Distintas', String(k.ciudades_trabajo_distintas)],
      ],
      [300, 150], MARGIN_X, y, onNewPage,
    );

    // 2) Top Ciudades de Trabajo
    y = this.pdfSection(doc, 'Top Ciudades de Trabajo', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['#', 'Ciudad', 'Total'],
      (data.topCiudadesTrabajo || []).map((r: any, i: number) => [
        String(i + 1),
        r.ciudad_trabajo || '—',
        String(r.total),
      ]),
      [40, 330, 80], MARGIN_X, y, onNewPage,
    );

    // 3) Egresados en el Extranjero por País
    if ((data.extranjerosPorPais || []).length > 0) {
      y = this.pdfSection(doc, 'Egresados en el Extranjero por País', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['País', 'Total'],
        (data.extranjerosPorPais || []).map((r: any) => [r.pais || '—', String(r.total)]),
        [290, 100], MARGIN_X, y, onNewPage,
      );
    }

    // 4) Movilidad por Año de Egreso
    y = this.pdfSection(doc, 'Movilidad por Año de Egreso', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Año', 'Total', 'Fuera Dgo.', 'Extranjero', '% F.Dgo.', '% Ext.'],
      (data.movilidadPorAnio || [])
        .sort((a: any, b: any) => Number(a.anio_egreso) - Number(b.anio_egreso))
        .map((r: any) => [
          String(r.anio_egreso),
          String(r.total),
          String(r.fuera_durango),
          String(r.en_extranjero),
          `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`,
          `${(+(r.pct_extranjero) || 0).toFixed(1)}%`,
        ]),
      [70, 70, 90, 90, 90, 90], MARGIN_X, y, onNewPage,
    );

    // 5) Movilidad por Carrera
    y = this.pdfSection(doc, 'Movilidad por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Total', 'Fuera Durango', '% Fuera Dgo.'],
      (data.movilidadPorCarrera || []).map((r: any) => [
        r.nombre_carrera,
        String(r.total),
        String(r.fuera_durango),
        `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`,
      ]),
      [260, 70, 110, 110], MARGIN_X, y, onNewPage,
    );

    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarGeografiaExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getDistribucionGeografica(carrera, anio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Distribución Geográfica', filtros, fecha, () => 0);
    const k = data.kpisGeo;

    // 1) Indicadores Geográficos
    {
      const ws = addSheet('Indicadores', 2, 'Indicadores Geográficos');
      ws.columns = [{ key: 'ind', width: 35 }, { key: 'val', width: 20 }];
      this.excelTable(ws, ['Indicador', 'Valor'], [
        ['Total Mapeados', k.total_mapeados],
        ['Con Ciudad de Trabajo', k.con_ciudad_trabajo],
        ['En Extranjero', k.en_extranjero],
        ['Países Distintos', k.paises_distintos],
        ['Ciudades de Trabajo Distintas', k.ciudades_trabajo_distintas],
      ], 4);
    }

    // 2) Top Ciudades de Trabajo
    {
      const ws = addSheet('Top Ciudades', 3, 'Top Ciudades de Trabajo');
      ws.columns = [{ key: 'r', width: 12 }, { key: 'c', width: 35 }, { key: 't', width: 15 }];
      this.excelTable(ws, ['Ranking', 'Ciudad de Trabajo', 'Total'],
        (data.topCiudadesTrabajo || []).map((r: any, i: number) => [i + 1, r.ciudad_trabajo || '—', r.total]),
        4,
      );
    }

    // 3) Egresados en el Extranjero por País
    {
      const ws = addSheet('Extranjeros por País', 2, 'Egresados en el Extranjero por País');
      ws.columns = [{ key: 'p', width: 30 }, { key: 't', width: 15 }];
      this.excelTable(ws, ['País', 'Total'],
        (data.extranjerosPorPais || []).map((r: any) => [r.pais || '—', r.total]),
        4,
      );
    }

    // 4) Movilidad por Año de Egreso
    {
      const ws = addSheet('Movilidad por Año', 6, 'Movilidad por Año de Egreso');
      ws.columns = [
        { key: 'a', width: 12 },
        { key: 't', width: 12 },
        { key: 'fd', width: 18 },
        { key: 'ex', width: 16 },
        { key: 'pfd', width: 18 },
        { key: 'pex', width: 16 },
      ];
      this.excelTable(
        ws,
        ['Año', 'Total', 'Fuera Durango', 'En Extranjero', '% Fuera Durango', '% Extranjero'],
        [...(data.movilidadPorAnio || [])]
          .sort((a: any, b: any) => Number(a.anio_egreso) - Number(b.anio_egreso))
          .map((r: any) => [
            r.anio_egreso,
            r.total,
            r.fuera_durango,
            r.en_extranjero,
            +(+(r.pct_fuera_durango) || 0).toFixed(2),
            +(+(r.pct_extranjero) || 0).toFixed(2),
          ]),
        4,
      );
    }

    // 5) Movilidad por Carrera
    {
      const ws = addSheet('Movilidad por Carrera', 4, 'Movilidad por Carrera');
      ws.columns = [
        { key: 'c', width: 38 },
        { key: 't', width: 12 },
        { key: 'fd', width: 18 },
        { key: 'p', width: 18 },
      ];
      this.excelTable(
        ws,
        ['Carrera', 'Total', 'Fuera Durango', '% Fuera Durango'],
        (data.movilidadPorCarrera || []).map((r: any) => [
          r.nombre_carrera,
          r.total,
          r.fuera_durango,
          +(+(r.pct_fuera_durango) || 0).toFixed(2),
        ]),
        4,
      );
    }

    return this.toBuffer(wb);
  }

  // PÁGINA 7 — Géneros

  async exportarGenerosPdf(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticasGenero(carrera, anio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);

    // Sin título repetido en páginas adicionales
    const onNewPage = () => this.pdfNewPage(doc);

    let y = this.pdfPageHeader(doc, 'Estadísticas por Género', filtros, fecha);

    // 1) Indicadores Generales
    y = this.pdfSection(doc, 'Indicadores Generales', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Total', 'Porcentaje'],
      (data.kpisGenero || []).map((r: any) => [
        r.genero, String(r.total), `${(+(r.porcentaje) || 0).toFixed(1)}%`,
      ]),
      [200, 100, 100], MARGIN_X, y, onNewPage,
    );

    // 2) Egresados por Año (H vs M)
    y = this.pdfSection(doc, 'Egresados por Año (Hombres vs Mujeres)', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Año', 'Género', 'Total', '% en Año'],
      (data.egresoAnioGenero || []).map((r: any) => [
        String(r.anio_egreso), r.genero, String(r.total),
        `${(+(r.porcentaje_en_anio) || 0).toFixed(1)}%`,
      ]),
      [70, 100, 70, 80], MARGIN_X, y, onNewPage,
    );

    // 3) Tendencia H/M por Año (pivoteada: una fila por año, col H y col M)
    y = this.pdfSection(doc, 'Tendencia H/M por Año', y, onNewPage);
    const tendenciaMap = new Map<string, Record<string, number>>();
    for (const r of data.egresoAnioGenero || []) {
      if (!tendenciaMap.has(String(r.anio_egreso)))
        tendenciaMap.set(String(r.anio_egreso), {});
      tendenciaMap.get(String(r.anio_egreso))![r.genero] = Number(r.total);
    }
    const tendenciaRows = [...tendenciaMap.entries()]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([anio, g]) => {
        const h = g['Hombre'] ?? g['Masculino'] ?? 0;
        const m = g['Mujer'] ?? g['Femenino'] ?? 0;
        const t = h + m;
        return [
          anio,
          String(h),
          String(m),
          String(t),
          t > 0 ? `${((m / t) * 100).toFixed(1)}%` : '0%',
        ];
      });
    y = this.pdfTable(
      doc,
      ['Año', 'Hombres', 'Mujeres', 'Total', '% Mujeres'],
      tendenciaRows,
      [70, 90, 90, 70, 90], MARGIN_X, y, onNewPage,
    );

    // 4) Ranking por Feminización (% mujeres por carrera, de mayor a menor)
    y = this.pdfSection(doc, 'Ranking por Feminización', y, onNewPage);
    const femMap = new Map<string, { h: number; m: number }>();
    for (const r of data.composicionCarreraGenero || []) {
      if (!femMap.has(r.nombre_carrera))
        femMap.set(r.nombre_carrera, { h: 0, m: 0 });
      const entry = femMap.get(r.nombre_carrera)!;
      const esMujer = r.genero === 'Mujer' || r.genero === 'Femenino';
      if (esMujer) entry.m += Number(r.total);
      else entry.h += Number(r.total);
    }
    const rankingRows = [...femMap.entries()]
      .map(([carrera, g]) => {
        const t = g.h + g.m;
        const pctM = t > 0 ? (g.m / t) * 100 : 0;
        return { carrera, h: g.h, m: g.m, t, pctM };
      })
      .sort((a, b) => b.pctM - a.pctM)
      .map((r, i) => [
        String(i + 1), r.carrera, String(r.h), String(r.m), String(r.t),
        `${r.pctM.toFixed(1)}%`,
      ]);
    y = this.pdfTable(
      doc,
      ['#', 'Carrera', 'Hombres', 'Mujeres', 'Total', '% Mujeres'],
      rankingRows,
      [30, 190, 75, 75, 65, 90], MARGIN_X, y, onNewPage,
    );

    // 5) Composición H/M por Carrera
    y = this.pdfSection(doc, 'Composición H/M por Carrera', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Carrera', 'Género', 'Total', '%'],
      (data.composicionCarreraGenero || []).map((r: any) => [
        r.nombre_carrera, r.genero, String(r.total),
        `${(+(r.porcentaje) || 0).toFixed(1)}%`,
      ]),
      [220, 90, 65, 65], MARGIN_X, y, onNewPage,
    );

    // 6) Empleabilidad por Género (Tasa de empleo)
    y = this.pdfSection(doc, 'Empleabilidad por Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Total', 'Empleados', 'Desempl.', '% Emp.', 'Satisf.'],
      (data.empleabilidadGenero || []).map((r: any) => [
        r.genero, String(r.total), String(r.empleados), String(r.desempleados),
        `${(+(r.pct_empleados) || 0).toFixed(1)}%`,
        (+(r.satisfaccion_promedio) || 0).toFixed(2),
      ]),
      [100, 65, 80, 80, 75, 75], MARGIN_X, y, onNewPage,
    );

    // 7) Sector de Trabajo
    y = this.pdfSection(doc, 'Sector de Trabajo por Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Sector', 'Total', '%'],
      (data.sectorLaboralGenero || []).map((r: any) => [
        r.genero, r.sector || '—', String(r.total),
        `${(+(r.porcentaje) || 0).toFixed(1)}%`,
      ]),
      [90, 220, 65, 65], MARGIN_X, y, onNewPage,
    );

    // 8) Coincidencia y Tiempo
    y = this.pdfSection(doc, 'Coincidencia Laboral y Tiempo para Emplearse', y, onNewPage);

    // Tiempo por género
    const tiempoMap = new Map<string, string>();
    for (const t of data.tiempoEmpleoGenero || []) {
      tiempoMap.set(t.genero, `${(+(t.tiempo_promedio_anios) || 0).toFixed(1)} años`);
    }
    // Coincidencia positiva por género
    const coincPosGenero = new Map<string, number>();
    const coincTotalGenero = new Map<string, number>();
    for (const c of data.coincidenciaLaboralGenero || []) {
      coincTotalGenero.set(c.genero, (coincTotalGenero.get(c.genero) || 0) + Number(c.total));
      const esPos =
        c.coincidencia?.toLowerCase().includes('alta') ||
        c.coincidencia?.toLowerCase().includes('totalmente') ||
        c.coincidencia?.toLowerCase().includes('relacionad') ||
        c.coincidencia?.toLowerCase().includes('gran medida');
      if (esPos)
        coincPosGenero.set(c.genero, (coincPosGenero.get(c.genero) || 0) + Number(c.total));
    }
    const coincidenciaRows = (data.kpisGenero || []).map((r: any) => {
      const ct = coincTotalGenero.get(r.genero) || 0;
      const cp = coincPosGenero.get(r.genero) || 0;
      return [
        r.genero,
        tiempoMap.get(r.genero) || '—',
        ct > 0 ? `${Math.round((cp / ct) * 100)}%` : '—',
      ];
    });
    y = this.pdfTable(
      doc,
      ['Género', 'Tiempo Prom. Empleo', '% Coincidencia Positiva'],
      coincidenciaRows,
      [100, 160, 180], MARGIN_X, y, onNewPage,
    );

    // 9) ¿Quién Emigra Más?
    y = this.pdfSection(doc, '¿Quién Emigra Más?', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Total', 'En Durango', 'Fuera Dgo.', 'Extranjero', '% Fuera Dgo.'],
      (data.geografiaGenero || []).map((r: any) => [
        r.genero, String(r.total), String(r.en_durango),
        String(r.fuera_durango_mexico), String(r.en_extranjero),
        `${(+(r.pct_fuera_durango) || 0).toFixed(1)}%`,
      ]),
      [90, 60, 90, 90, 90, 110], MARGIN_X, y, onNewPage,
    );

    // 10) Top Ciudades por Género
    y = this.pdfSection(doc, 'Top Ciudades de Trabajo por Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Ciudad', 'Total'],
      (data.topCiudadesGenero || []).slice(0, 20).map((r: any) => [
        r.genero, r.ciudad_trabajo || '—', String(r.total),
      ]),
      [90, 280, 80], MARGIN_X, y, onNewPage,
    );

    // 11) % Titulados por Género
    y = this.pdfSection(doc, '% Titulados por Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Total', 'Titulados', 'En Trámite', 'No Tit.', '% Tit.'],
      (data.titulacionGenero || []).map((r: any) => [
        r.genero, String(r.total), String(r.titulados),
        String(r.en_tramite), String(r.no_titulados),
        `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
      ]),
      [90, 65, 85, 90, 80, 80], MARGIN_X, y, onNewPage,
    );

    // 12) Titulación por Año y Género
    y = this.pdfSection(doc, 'Titulación por Año y Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Año', 'Género', 'Total', 'Titulados', '% Tit.'],
      (data.titulacionAnioGenero || []).map((r: any) => [
        String(r.anio_egreso), r.genero, String(r.total),
        String(r.titulados), `${(+(r.pct_titulados) || 0).toFixed(1)}%`,
      ]),
      [65, 90, 65, 80, 80], MARGIN_X, y, onNewPage,
    );

    // 13) ¿Quién Continúa Estudiando?
    if (!carrera) {
      y = this.pdfSection(doc, '¿Quién Continúa Estudiando? (Posgrado)', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Género', 'Total en Posgrado'],
        (data.posgradoGenero || []).map((r: any) => [r.genero, String(r.total)]),
        [150, 150], MARGIN_X, y, onNewPage,
      );
    }

    // 14) Tipo de Posgrado por Género
    if (!carrera) {
      y = this.pdfSection(doc, 'Tipo de Posgrado por Género', y, onNewPage);
      y = this.pdfTable(
        doc,
        ['Género', 'Tipo de Posgrado', 'Total', '%'],
        (data.posgradoTipoGenero || []).map((r: any) => [
          r.genero, r.tipo_posgrado || '—', String(r.total),
          `${(+(r.porcentaje) || 0).toFixed(1)}%`,
        ]),
        [90, 220, 65, 65], MARGIN_X, y, onNewPage,
      );
    }

    // 15) Nivel de Inglés por Género
    y = this.pdfSection(doc, 'Nivel de Inglés por Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Nivel', 'Total', '%'],
      (data.inglesGenero || []).map((r: any) => [
        r.genero, r.nivel || '—', String(r.total),
        `${(+(r.porcentaje) || 0).toFixed(1)}%`,
      ]),
      [90, 200, 65, 75], MARGIN_X, y, onNewPage,
    );

    // 16) Satisfacción Promedio
    y = this.pdfSection(doc, 'Satisfacción Promedio por Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Prom.', 'Total', 'M.Satis.', 'Satis.', 'Neutral', 'Insat.', 'M.Insat.'],
      (data.satisfaccionGenero || []).map((r: any) => [
        r.genero, (+(r.promedio) || 0).toFixed(2), String(r.total),
        String(r.muy_satisfecho), String(r.satisfecho),
        String(r.neutral), String(r.insatisfecho), String(r.muy_insatisfecho),
      ]),
      [90, 55, 55, 75, 70, 70, 65, 75], MARGIN_X, y, onNewPage,
    );

    // 17) Habilidades que Faltaron
    y = this.pdfSection(doc, 'Habilidades que Faltaron por Género', y, onNewPage);
    y = this.pdfTable(
      doc,
      ['Género', 'Habilidad', 'Total', '%'],
      (data.habilidadesGenero || []).map((r: any) => [
        r.genero, r.habilidad || '—', String(r.total),
        `${(+(r.porcentaje) || 0).toFixed(1)}%`,
      ]),
      [90, 230, 65, 65], MARGIN_X, y, onNewPage,
    );

    // 18) Hallazgos Destacados
    const insights: { titulo: string; descripcion: string }[] = [];

    // Brecha de empleabilidad
    const empG = data.empleabilidadGenero || [];
    if (empG.length >= 2) {
      const sorted = [...empG].sort((a: any, b: any) => +(b.pct_empleados) - +(a.pct_empleados));
      const diff = Math.abs(+(sorted[0].pct_empleados) - +(sorted[sorted.length - 1].pct_empleados));
      if (diff > 2) {
        insights.push({
          titulo: 'Brecha de empleo',
          descripcion: `${sorted[0].genero} tiene mayor tasa de empleo (${sorted[0].pct_empleados}%) vs ${sorted[sorted.length - 1].genero} (${sorted[sorted.length - 1].pct_empleados}%). Diferencia: ${diff.toFixed(1)}pp.`,
        });
      }
    }

    // Brecha de titulación
    const titG = data.titulacionGenero || [];
    if (titG.length >= 2) {
      const sorted = [...titG].sort((a: any, b: any) => +(b.pct_titulados) - +(a.pct_titulados));
      const diff = Math.abs(+(sorted[0].pct_titulados) - +(sorted[sorted.length - 1].pct_titulados));
      if (diff > 2) {
        insights.push({
          titulo: 'Titulación',
          descripcion: `${sorted[0].genero} titula más (${sorted[0].pct_titulados}%) vs ${sorted[sorted.length - 1].genero} (${sorted[sorted.length - 1].pct_titulados}%). Diferencia: ${diff.toFixed(1)}pp.`,
        });
      }
    }

    // Posgrado — solo sin filtro de carrera
    if (!carrera) {
      const posG = data.posgradoGenero || [];
      if (posG.length >= 2) {
        const sorted = [...posG].sort((a: any, b: any) => +(b.total) - +(a.total));
        const totalPos = posG.reduce((s: number, r: any) => s + +r.total, 0);
        const topPos = sorted[0];
        const pctTop = totalPos > 0 ? ((+topPos.total / totalPos) * 100).toFixed(1) : '0';
        insights.push({
          titulo: 'Posgrado',
          descripcion: `${topPos.genero} tiene mayor continuidad en posgrado: ${pctTop}%.`,
        });
      }
    }

    // Movilidad geográfica
    const geoG = data.geografiaGenero || [];
    if (geoG.length >= 2) {
      const sorted = [...geoG].sort((a: any, b: any) => +(b.pct_fuera_durango) - +(a.pct_fuera_durango));
      insights.push({
        titulo: 'Movilidad geográfica',
        descripcion: `${sorted[0].genero} tiene mayor movilidad fuera de Durango. H: ${(+(geoG.find((r: any) => r.genero === 'Hombre' || r.genero === 'Masculino')?.pct_fuera_durango) || 0).toFixed(0)}% · M: ${(+(geoG.find((r: any) => r.genero === 'Mujer' || r.genero === 'Femenino')?.pct_fuera_durango) || 0).toFixed(0)}%`,
      });
    }

    // Satisfacción académica
    const satG = data.satisfaccionGenero || [];
    if (satG.length >= 2) {
      const sorted = [...satG].sort((a: any, b: any) => +(b.promedio) - +(a.promedio));
      const diff = Math.abs(+(sorted[0].promedio) - +(sorted[sorted.length - 1].promedio));
      if (diff > 0.05) {
        const h = satG.find((r: any) => r.genero === 'Hombre' || r.genero === 'Masculino');
        const m = satG.find((r: any) => r.genero === 'Mujer' || r.genero === 'Femenino');
        insights.push({
          titulo: 'Satisfacción académica',
          descripcion: `${sorted[0].genero} reporta mayor satisfacción. H: ${(+(h?.promedio) || 0).toFixed(2)}/5 · M: ${(+(m?.promedio) || 0).toFixed(2)}/5`,
        });
      }
    }

    // Carrera más feminizada — solo sin filtro de carrera
    if (!carrera && rankingRows.length > 0) {
      const top = rankingRows[0];
      insights.push({
        titulo: 'Carrera más feminizada',
        descripcion: `${top[1]} tiene el mayor porcentaje de mujeres: ${top[5]} de sus egresados.`,
      });
    }

    if (insights.length > 0) {
      y += 8;
      // Solo verifica que haya espacio para el título + 1 bloque
      if (y + 14 + 35 > PAGE_MAX_Y) y = onNewPage();
      doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold')
        .text('Hallazgos Destacados', MARGIN_X, y);
      y += 14;

      insights.forEach((insight) => {
        if (y + 36 > PAGE_MAX_Y) y = onNewPage();
        const BLOCK_W = 780;
        const BLOCK_H = 32;
        doc.rect(MARGIN_X, y, BLOCK_W, BLOCK_H).fill('#FDF2F6');
        doc.moveTo(MARGIN_X, y).lineTo(MARGIN_X + BLOCK_W, y)
          .strokeColor('#E5E7EB').lineWidth(0.4).stroke();
        doc.rect(MARGIN_X, y, 4, BLOCK_H).fill(VINO);
        doc.fontSize(8).fillColor(VINO).font('Helvetica-Bold')
          .text(insight.titulo, MARGIN_X + 12, y + 5, { width: 200, lineBreak: false });
        doc.fontSize(7).fillColor('#374151').font('Helvetica')
          .text(insight.descripcion, MARGIN_X + 12, y + 17, { width: 755, lineBreak: false, ellipsis: true });
        y += BLOCK_H + 3;
      });
    }

    this.pdfFooter(doc, fecha);
    doc.end();
    return bufPromise;
  }

  async exportarGenerosExcel(carrera?: string, anio?: number): Promise<Buffer> {
    const data = await this.egresadosService.getEstadisticasGenero(carrera, anio);
    const fecha = this.fechaStr();
    const filtros = this.filtroDesc(carrera, anio);
    const { wb, addSheet } = this.makeWorkbook('Estadísticas por Género', filtros, fecha, () => 0);

    // 1) Indicadores Generales
    {
      const ws = addSheet('Indicadores', 3, 'Indicadores Generales por Género');
      ws.columns = [{ key: 'g', width: 20 }, { key: 't', width: 15 }, { key: 'p', width: 16 }];
      this.excelTable(ws, ['Género', 'Total', 'Porcentaje (%)'],
        (data.kpisGenero || []).map((r: any) => [r.genero, r.total, +(+(r.porcentaje) || 0).toFixed(2)]),
        4,
      );
    }

    // 2) Egresados por Año (H vs M)
    {
      const ws = addSheet('Egresados por Año', 4, 'Egresados por Año (Hombres vs Mujeres)');
      ws.columns = [
        { key: 'a', width: 12 }, { key: 'g', width: 20 },
        { key: 't', width: 12 }, { key: 'p', width: 18 },
      ];
      this.excelTable(ws, ['Año', 'Género', 'Total', '% en Año'],
        (data.egresoAnioGenero || []).map((r: any) => [
          r.anio_egreso, r.genero, r.total,
          +(+(r.porcentaje_en_anio) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 3) Tendencia H/M por Año (pivoteada)
    {
      const ws = addSheet('Tendencia H-M por Año', 5, 'Tendencia H/M por Año');
      ws.columns = [
        { key: 'a', width: 12 }, { key: 'h', width: 14 },
        { key: 'm', width: 14 }, { key: 't', width: 12 },
        { key: 'pm', width: 16 },
      ];
      const tendenciaMap = new Map<string, Record<string, number>>();
      for (const r of data.egresoAnioGenero || []) {
        if (!tendenciaMap.has(String(r.anio_egreso)))
          tendenciaMap.set(String(r.anio_egreso), {});
        tendenciaMap.get(String(r.anio_egreso))![r.genero] = Number(r.total);
      }
      const tendenciaRows = [...tendenciaMap.entries()]
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([anio, g]) => {
          const h = g['Hombre'] ?? g['Masculino'] ?? 0;
          const m = g['Mujer'] ?? g['Femenino'] ?? 0;
          const t = h + m;
          return [Number(anio), h, m, t, t > 0 ? +((m / t) * 100).toFixed(2) : 0];
        });
      this.excelTable(ws, ['Año', 'Hombres', 'Mujeres', 'Total', '% Mujeres'],
        tendenciaRows, 4,
      );
    }

    // 4) Ranking por Feminización
    {
      const ws = addSheet('Ranking Feminización', 6, 'Ranking por Feminización');
      ws.columns = [
        { key: 'r', width: 8 }, { key: 'c', width: 38 },
        { key: 'h', width: 14 }, { key: 'm', width: 14 },
        { key: 't', width: 12 }, { key: 'pm', width: 16 },
      ];
      const femMap = new Map<string, { h: number; m: number }>();
      for (const r of data.composicionCarreraGenero || []) {
        if (!femMap.has(r.nombre_carrera)) femMap.set(r.nombre_carrera, { h: 0, m: 0 });
        const entry = femMap.get(r.nombre_carrera)!;
        const esMujer = r.genero === 'Mujer' || r.genero === 'Femenino';
        if (esMujer) entry.m += Number(r.total); else entry.h += Number(r.total);
      }
      const rankingRows = [...femMap.entries()]
        .map(([carrera, g]) => {
          const t = g.h + g.m;
          return { carrera, h: g.h, m: g.m, t, pctM: t > 0 ? (g.m / t) * 100 : 0 };
        })
        .sort((a, b) => b.pctM - a.pctM)
        .map((r, i) => [i + 1, r.carrera, r.h, r.m, r.t, +r.pctM.toFixed(2)]);
      this.excelTable(ws, ['#', 'Carrera', 'Hombres', 'Mujeres', 'Total', '% Mujeres'],
        rankingRows, 4,
      );
    }

    // 5) Composición H/M por Carrera
    {
      const ws = addSheet('Composición por Carrera', 4, 'Composición H/M por Carrera');
      ws.columns = [
        { key: 'c', width: 38 }, { key: 'g', width: 20 },
        { key: 't', width: 12 }, { key: 'p', width: 16 },
      ];
      this.excelTable(ws, ['Carrera', 'Género', 'Total', 'Porcentaje (%)'],
        (data.composicionCarreraGenero || []).map((r: any) => [
          r.nombre_carrera, r.genero, r.total, +(+(r.porcentaje) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 6) Empleabilidad por Género
    {
      const ws = addSheet('Empleabilidad', 6, 'Empleabilidad por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 't', width: 12 }, { key: 'e', width: 14 },
        { key: 'd', width: 14 }, { key: 'p', width: 16 }, { key: 's', width: 22 },
      ];
      this.excelTable(ws, ['Género', 'Total', 'Empleados', 'Desempleados', '% Empleados', 'Satisfacción Promedio'],
        (data.empleabilidadGenero || []).map((r: any) => [
          r.genero, r.total, r.empleados, r.desempleados,
          +(+(r.pct_empleados) || 0).toFixed(2),
          +(+(r.satisfaccion_promedio) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 7) Sector de Trabajo
    {
      const ws = addSheet('Sector de Trabajo', 4, 'Sector de Trabajo por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 's', width: 30 },
        { key: 't', width: 12 }, { key: 'p', width: 16 },
      ];
      this.excelTable(ws, ['Género', 'Sector', 'Total', 'Porcentaje (%)'],
        (data.sectorLaboralGenero || []).map((r: any) => [
          r.genero, r.sector || '—', r.total, +(+(r.porcentaje) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 8) Coincidencia y Tiempo
    {
      const ws = addSheet('Coincidencia y Tiempo', 5, 'Coincidencia Laboral y Tiempo para Emplearse');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 'co', width: 26 },
        { key: 't', width: 12 }, { key: 'p', width: 16 },
        { key: 'te', width: 24 },
      ];
      const tiempoMap = new Map<string, number>();
      for (const t of data.tiempoEmpleoGenero || [])
        tiempoMap.set(t.genero, +(t.tiempo_promedio_anios) || 0);

      const coincRows = (data.coincidenciaLaboralGenero || []).map((r: any) => [
        r.genero, r.coincidencia || '—', r.total,
        +(+(r.porcentaje) || 0).toFixed(2),
        tiempoMap.get(r.genero) ?? null,
      ]);
      this.excelTable(
        ws,
        ['Género', 'Coincidencia', 'Total', 'Porcentaje (%)', 'Años Prom. para Emplearse'],
        coincRows, 4,
      );
    }

    // 9) ¿Quién Emigra Más?
    {
      const ws = addSheet('Quien Emigra Mas', 6, '¿Quién Emigra Más?')
      ws.columns = [
        { key: 'g', width: 20 }, { key: 't', width: 12 },
        { key: 'ed', width: 16 }, { key: 'fd', width: 18 },
        { key: 'ex', width: 16 }, { key: 'pf', width: 18 },
      ];
      this.excelTable(
        ws,
        ['Género', 'Total', 'En Durango', 'Fuera Dgo.', 'Extranjero', '% Fuera Durango'],
        (data.geografiaGenero || []).map((r: any) => [
          r.genero, r.total, r.en_durango, r.fuera_durango_mexico,
          r.en_extranjero, +(+(r.pct_fuera_durango) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 10) Top Ciudades por Género
    {
      const ws = addSheet('Top Ciudades', 3, 'Top Ciudades de Trabajo por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 'c', width: 30 }, { key: 't', width: 12 },
      ];
      this.excelTable(ws, ['Género', 'Ciudad', 'Total'],
        (data.topCiudadesGenero || []).map((r: any) => [
          r.genero, r.ciudad_trabajo || '—', r.total,
        ]),
        4,
      );
    }

    // 11) % Titulados por Género
    {
      const ws = addSheet('% Titulados', 8, '% Titulados por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 't', width: 12 },
        { key: 'tt', width: 14 }, { key: 'tr', width: 14 },
        { key: 'nt', width: 16 }, { key: 'pt', width: 14 },
        { key: 'ptr', width: 14 }, { key: 'pnt', width: 16 },
      ];
      this.excelTable(
        ws,
        ['Género', 'Total', 'Titulados', 'En Trámite', 'No Titulados',
          '% Titulados', '% En Trámite', '% No Titulados'],
        (data.titulacionGenero || []).map((r: any) => [
          r.genero, r.total, r.titulados, r.en_tramite, r.no_titulados,
          +(+(r.pct_titulados) || 0).toFixed(2),
          +(+(r.pct_en_tramite) || 0).toFixed(2),
          +(+(r.pct_no_titulados) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 12) Titulación por Año y Género
    {
      const ws = addSheet('Titulación por Año', 5, 'Titulación por Año y Género');
      ws.columns = [
        { key: 'a', width: 12 }, { key: 'g', width: 20 },
        { key: 't', width: 12 }, { key: 'tt', width: 14 },
        { key: 'pt', width: 16 },
      ];
      this.excelTable(ws, ['Año', 'Género', 'Total', 'Titulados', '% Titulados'],
        (data.titulacionAnioGenero || []).map((r: any) => [
          r.anio_egreso, r.genero, r.total, r.titulados,
          +(+(r.pct_titulados) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 13) ¿Quién Continúa Estudiando?
    if (!carrera) {
      const ws = addSheet('Quien Estudia Posgrado', 2, '¿Quién Continúa Estudiando? (Posgrado)');
      ws.columns = [{ key: 'g', width: 20 }, { key: 't', width: 20 }];
      this.excelTable(ws, ['Género', 'Total en Posgrado'],
        (data.posgradoGenero || []).map((r: any) => [r.genero, r.total]),
        4,
      );
    }

    // 14) Tipo de Posgrado por Género
    if (!carrera) {
      const ws = addSheet('Tipo de Posgrado', 4, 'Tipo de Posgrado por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 'tp', width: 30 },
        { key: 't', width: 12 }, { key: 'p', width: 16 },
      ];
      this.excelTable(ws, ['Género', 'Tipo de Posgrado', 'Total', 'Porcentaje (%)'],
        (data.posgradoTipoGenero || []).map((r: any) => [
          r.genero, r.tipo_posgrado || '—', r.total,
          +(+(r.porcentaje) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 15) Nivel de Inglés por Género
    {
      const ws = addSheet('Nivel de Inglés', 4, 'Nivel de Inglés por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 'n', width: 26 },
        { key: 't', width: 12 }, { key: 'p', width: 16 },
      ];
      this.excelTable(ws, ['Género', 'Nivel', 'Total', 'Porcentaje (%)'],
        (data.inglesGenero || []).map((r: any) => [
          r.genero, r.nivel || '—', r.total, +(+(r.porcentaje) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 16) Satisfacción Promedio
    {
      const ws = addSheet('Satisfacción', 8, 'Satisfacción Promedio por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 'pr', width: 14 },
        { key: 't', width: 12 }, { key: 'ms', width: 16 },
        { key: 's', width: 14 }, { key: 'n', width: 12 },
        { key: 'i', width: 14 }, { key: 'mi', width: 18 },
      ];
      this.excelTable(
        ws,
        ['Género', 'Promedio', 'Total', 'Muy Satisfecho', 'Satisfecho',
          'Neutral', 'Insatisfecho', 'Muy Insatisfecho'],
        (data.satisfaccionGenero || []).map((r: any) => [
          r.genero, +(+(r.promedio) || 0).toFixed(2), r.total,
          r.muy_satisfecho, r.satisfecho, r.neutral, r.insatisfecho, r.muy_insatisfecho,
        ]),
        4,
      );
    }

    // 17) Habilidades que Faltaron
    {
      const ws = addSheet('Habilidades', 4, 'Habilidades que Faltaron por Género');
      ws.columns = [
        { key: 'g', width: 20 }, { key: 'h', width: 32 },
        { key: 't', width: 12 }, { key: 'p', width: 16 },
      ];
      this.excelTable(ws, ['Género', 'Habilidad', 'Total', 'Porcentaje (%)'],
        (data.habilidadesGenero || []).map((r: any) => [
          r.genero, r.habilidad || '—', r.total, +(+(r.porcentaje) || 0).toFixed(2),
        ]),
        4,
      );
    }

    // 18) Hallazgos Destacados
    // 18) Hallazgos Destacados
    {
      const ws = addSheet('Hallazgos', 2, 'Hallazgos Destacados');
      ws.columns = [{ key: 'titulo', width: 35 }, { key: 'desc', width: 90 }];

      const insights: (string | number | null)[][] = [];

      // Brecha de empleabilidad
      const empG = data.empleabilidadGenero || [];
      if (empG.length >= 2) {
        const sorted = [...empG].sort((a: any, b: any) => +(b.pct_empleados) - +(a.pct_empleados));
        const diff = Math.abs(+(sorted[0].pct_empleados) - +(sorted[sorted.length - 1].pct_empleados));
        if (diff > 2) {
          insights.push([
            'Brecha de empleo',
            `${sorted[0].genero} tiene mayor tasa de empleo (${sorted[0].pct_empleados}%) vs ${sorted[sorted.length - 1].genero} (${sorted[sorted.length - 1].pct_empleados}%). Diferencia: ${diff.toFixed(1)}pp.`,
          ]);
        }
      }

      // Titulación
      const titG = data.titulacionGenero || [];
      if (titG.length >= 2) {
        const sorted = [...titG].sort((a: any, b: any) => +(b.pct_titulados) - +(a.pct_titulados));
        const diff = Math.abs(+(sorted[0].pct_titulados) - +(sorted[sorted.length - 1].pct_titulados));
        if (diff > 2) {
          insights.push([
            'Titulación',
            `${sorted[0].genero} titula más (${sorted[0].pct_titulados}%) vs ${sorted[sorted.length - 1].genero} (${sorted[sorted.length - 1].pct_titulados}%). Diferencia: ${diff.toFixed(1)}pp.`,
          ]);
        }
      }

      // Posgrado — solo sin filtro de carrera
      if (!carrera) {
        const posG = data.posgradoGenero || [];
        if (posG.length >= 2) {
          const sorted = [...posG].sort((a: any, b: any) => +(b.total) - +(a.total));
          const totalPos = posG.reduce((s: number, r: any) => s + +r.total, 0);
          const topPos = sorted[0];
          const pctTop = totalPos > 0 ? ((+topPos.total / totalPos) * 100).toFixed(1) : '0';
          insights.push([
            'Posgrado',
            `${topPos.genero} tiene mayor continuidad en posgrado: ${pctTop}%.`,
          ]);
        }
      }

      // Movilidad geográfica
      const geoG = data.geografiaGenero || [];
      if (geoG.length >= 2) {
        const sorted = [...geoG].sort((a: any, b: any) => +(b.pct_fuera_durango) - +(a.pct_fuera_durango));
        const h = geoG.find((r: any) => r.genero === 'Hombre' || r.genero === 'Masculino');
        const m = geoG.find((r: any) => r.genero === 'Mujer' || r.genero === 'Femenino');
        insights.push([
          'Movilidad geográfica',
          `${sorted[0].genero} tiene mayor movilidad fuera de Durango. H: ${(+(h?.pct_fuera_durango) || 0).toFixed(0)}% · M: ${(+(m?.pct_fuera_durango) || 0).toFixed(0)}%`,
        ]);
      }

      // Satisfacción académica
      const satG = data.satisfaccionGenero || [];
      if (satG.length >= 2) {
        const sorted = [...satG].sort((a: any, b: any) => +(b.promedio) - +(a.promedio));
        const diff = Math.abs(+(sorted[0].promedio) - +(sorted[sorted.length - 1].promedio));
        if (diff > 0.05) {
          const h = satG.find((r: any) => r.genero === 'Hombre' || r.genero === 'Masculino');
          const m = satG.find((r: any) => r.genero === 'Mujer' || r.genero === 'Femenino');
          insights.push([
            'Satisfacción académica',
            `${sorted[0].genero} reporta mayor satisfacción. H: ${(+(h?.promedio) || 0).toFixed(2)}/5 · M: ${(+(m?.promedio) || 0).toFixed(2)}/5`,
          ]);
        }
      }

      // Carrera más feminizada — solo sin filtro de carrera
      if (!carrera) {
        const femMap2 = new Map<string, { h: number; m: number }>();
        for (const r of data.composicionCarreraGenero || []) {
          if (!femMap2.has(r.nombre_carrera)) femMap2.set(r.nombre_carrera, { h: 0, m: 0 });
          const entry = femMap2.get(r.nombre_carrera)!;
          const esMujer = r.genero === 'Mujer' || r.genero === 'Femenino';
          if (esMujer) entry.m += Number(r.total); else entry.h += Number(r.total);
        }
        const topFem = [...femMap2.entries()]
          .map(([c, g]) => ({ c, pctM: (g.h + g.m) > 0 ? (g.m / (g.h + g.m)) * 100 : 0 }))
          .sort((a, b) => b.pctM - a.pctM)[0];
        if (topFem) {
          insights.push([
            'Carrera más feminizada',
            `${topFem.c} tiene el mayor porcentaje de mujeres: ${topFem.pctM.toFixed(1)}%.`,
          ]);
        }
      }

      const nextRow = this.excelTable(ws, ['Hallazgo', 'Descripción'], insights, 4);
      for (let r = 5; r < nextRow; r++) {
        const row = ws.getRow(r);
        row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
        row.height = 30;
      }
    }

    return this.toBuffer(wb);
  }
}