const PDFDocument = require('pdfkit');

import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { InclusionService } from '../inclusion.service';

// Mismos helpers y estilo visual que src/egresados/export/export-estadisticas.service.ts.
// Este servicio SOLO recibe conteos agregados de InclusionService (que ya aplica el
// umbral en SQL): ningún nombre, correo ni id_egresado individual pasa por aquí.

const VINO = '#6b1232';
const GRIS = '#6B7280';
const NEGRO = '#1F2937';
const COLOR_VINO_ARG = 'FF6b1232';
const COLOR_ALT_ARG = 'FFFDF2F6';

const PAGE_MAX_Y = 550;
const MARGIN_X = 28;

@Injectable()
export class ExportInclusionService {
  constructor(private readonly inclusionService: InclusionService) { }

  // Un valor oculto por umbral se imprime como "—", nunca como 0 ni vacío.
  private val(v: number | string | null | undefined): string {
    return v === null || v === undefined ? '—' : String(v);
  }

  // Igual que val(), pero para Excel: la celda debe quedar numérica de
  // verdad (ordenable/sumable), no como texto.
  //
  // mysql2 devuelve los resultados de COUNT()/agregados como STRING
  // (p.ej. "302"), no como number — a diferencia de una columna INT
  // seleccionada directa (como anio_egreso), que sí llega como number.
  // Por eso no basta con reenviar `v` tal cual: hay que forzar Number(v).
  // Confirmado con scripts/diagnose-inclusion-excel.ts: sin este Number(),
  // la celda quedaba como texto aunque valNum() ya se estuviera llamando.
  private valNum(v: number | string | null | undefined): number | string {
    return v === null || v === undefined ? '—' : Number(v);
  }

  private fechaStr(): string {
    return new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  private periodoStr(anioMin: number | null, anioMax: number | null): string {
    if (anioMin === null || anioMax === null) return 'Período: sin datos de año de egreso';
    return anioMin === anioMax ? `Período cubierto: ${anioMin}` : `Período cubierto: ${anioMin}–${anioMax}`;
  }

  // PDF helpers (idénticos en firma y estilo a ExportEstadisticasService)

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
    // Evita encabezado + 1 fila huérfana al pie de página: exige que quepan
    // encabezado + al menos 3 filas antes de empezar la tabla aquí.
    const MIN_ROWS_TO_SHOW = 3;
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
      row.forEach((v, ci) => {
        doc.fontSize(7).fillColor(NEGRO).font('Helvetica')
          .text(v ?? '—', x + 3, y + 5, {
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

  // rowHeight debe ser el mismo que se le pasará a pdfTable() justo después,
  // para que el cálculo de espacio (título + encabezado de tabla + 3 filas)
  // sea el real y el título nunca quede solo al pie de página con su tabla
  // empezando en la siguiente.
  private pdfSection(doc: any, titulo: string, y: number, onNewPage?: () => number, rowHeight: number = 26): number {
    const HDR_H = 18;
    const MIN_ROWS = 3;
    const TITULO_BLOQUE_H = 6 + 14; // separación antes del título + alto del título
    const spaceNeeded = TITULO_BLOQUE_H + HDR_H + (MIN_ROWS * rowHeight);

    if (y + spaceNeeded > PAGE_MAX_Y) {
      if (onNewPage) y = onNewPage();
    }
    y += 6;
    doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold').text(titulo, MARGIN_X, y);
    return y + 14;
  }

  private pdfPageHeader(doc: any, titulo: string, subtitulo: string, fecha: string): number {
    doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold').text('Sistema de Seguimiento de Egresados', MARGIN_X, 18);
    doc.fontSize(15).fillColor(NEGRO).font('Helvetica-Bold').text(titulo, MARGIN_X, 32);
    doc.fontSize(7.5).fillColor(GRIS).font('Helvetica').text(`${subtitulo}   |   Generado: ${fecha}`, MARGIN_X, 52);
    return 68;
  }

  // Nota del umbral, impresa como texto visible debajo del encabezado, para
  // que quien reciba el archivo entienda qué significan los guiones "—".
  private pdfNota(doc: any, texto: string, y: number, onNewPage: () => number): number {
    const width = 780;
    const alto = doc.heightOfString(texto, { width, fontSize: 7.5 });
    if (y + alto + 10 > PAGE_MAX_Y) y = onNewPage();
    doc.rect(MARGIN_X, y, width, alto + 10).fill('#FDF2F6');
    doc.fontSize(7.5).fillColor('#374151').font('Helvetica-Oblique')
      .text(texto, MARGIN_X + 8, y + 5, { width: width - 16 });
    return y + alto + 18;
  }

  // Pie de página con numeración; se dibuja en todas las páginas ya
  // generadas recorriendo bufferedPageRange() antes de doc.end().
  //
  // OJO: la posición se calcula desde doc.page.height/width (nunca una
  // coordenada fija) porque este reporte es A4 horizontal (~595pt de alto),
  // no vertical. Además, mientras se escribe se pone margins.bottom = 0:
  // si no, PDFKit detecta que el texto cae fuera del área de contenido
  // (por debajo de height - bottom) y agrega una página nueva en blanco
  // por cada pie que se intenta escribir.
  private pdfFooter(doc: any, fecha: string, pageNum: number, totalPages: number): void {
    const originalBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    try {
      const footerY = doc.page.height - 25;
      const usableWidth = doc.page.width - MARGIN_X * 2;
      doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica')
        .text(`Generado el ${fecha} - Sistema de Seguimiento de Egresados`, MARGIN_X, footerY, {
          width: usableWidth, align: 'left', lineBreak: false,
        });
      doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica')
        .text(`Página ${pageNum} de ${totalPages}`, MARGIN_X, footerY, {
          width: usableWidth, align: 'right', lineBreak: false,
        });
    } finally {
      doc.page.margins.bottom = originalBottom;
    }
  }

  private pdfFooterAllPages(doc: any, fecha: string): void {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      this.pdfFooter(doc, fecha, i + 1, totalPages);
    }
    const countAfter = doc.bufferedPageRange().count;
    if (countAfter !== totalPages) {
      throw new Error(`pdfFooterAllPages: se esperaban ${totalPages} páginas pero quedaron ${countAfter} después de escribir el pie.`);
    }
  }

  private pdfDoc(): any {
    return new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 50, bottom: 40, left: MARGIN_X, right: MARGIN_X }, bufferPages: true });
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

  private excelHeader(ws: ExcelJS.Worksheet, title: string, subtitulo: string, numCols: number, fecha: string, nota: string): void {
    const lastCol = String.fromCharCode(64 + numCols);
    ws.mergeCells(`A1:${lastCol}1`); const t = ws.getCell('A1'); t.value = title; t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VINO_ARG } }; t.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(1).height = 28;
    ws.mergeCells(`A2:${lastCol}2`); const f = ws.getCell('A2'); f.value = `${subtitulo}   |   Generado: ${fecha}`; f.font = { italic: true, size: 8.5, color: { argb: 'FF6B7280' } }; f.alignment = { horizontal: 'left', vertical: 'middle' }; ws.getRow(2).height = 16;
    ws.mergeCells(`A3:${lastCol}3`); const n = ws.getCell('A3'); n.value = `Nota: ${nota}`; n.font = { italic: true, size: 8, color: { argb: 'FF9CA3AF' } }; n.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; ws.getRow(3).height = 30;
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

    // Una columna es numérica si todos sus valores son number o el
    // placeholder '—' (oculto por umbral); así se alinea a la derecha
    // completa, sin que el '—' quede desalineado respecto a los números.
    const numericCols = headers.map((_, ci) =>
      rows.every(row => typeof row[ci] === 'number' || row[ci] === '—'),
    );

    rows.forEach((row, ri) => {
      const dataRow = ws.addRow(row);
      const bg = ri % 2 === 0 ? COLOR_ALT_ARG : 'FFFFFFFF';
      dataRow.eachCell({ includeEmpty: true }, (cell, ci) => {
        if (ci <= headers.length) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle', horizontal: numericCols[ci - 1] ? 'right' : 'left' };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
        }
      });
      dataRow.height = 18;
    });
    const lastCol = String.fromCharCode(64 + headers.length);
    ws.autoFilter = { from: `A${startRow}`, to: `${lastCol}${startRow}` };
    return startRow + 1 + rows.length;
  }

  private async toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }

  // Reúne los cinco reportes agregados. Todo lo que sale de aquí ya pasó por
  // el umbral aplicado en SQL en InclusionService; esta capa solo da formato.
  private async recolectarDatos() {
    const [resumen, discapacidad, identidad, porCarrera, porAnio] = await Promise.all([
      this.inclusionService.getResumen(),
      this.inclusionService.getDiscapacidadPorDominio(),
      this.inclusionService.getIdentidadPorPregunta(),
      this.inclusionService.getPorCarrera(),
      this.inclusionService.getPorAnioEgreso(),
    ]);
    return { resumen, discapacidad, identidad, porCarrera, porAnio };
  }

  // EXPORT PDF

  async exportarInclusionPdf(): Promise<Buffer> {
    const { resumen, discapacidad, identidad, porCarrera, porAnio } = await this.recolectarDatos();
    const fecha = this.fechaStr();
    const doc = this.pdfDoc();
    const bufPromise = this.collectBuffer(doc);
    const onNewPage = () => this.pdfNewPage(doc);

    const k = resumen.datos as any;
    const cobertura = k.cobertura as { anio_min: number | null; anio_max: number | null; decadas: { etiqueta: string; desde: number; hasta: number; total: number }[] };

    // 1) Encabezado: período cubierto + desglose por década
    let y = this.pdfPageHeader(doc, 'Inclusión y Diversidad', this.periodoStr(cobertura.anio_min, cobertura.anio_max), fecha);
    y = this.pdfNota(doc, resumen.nota, y, onNewPage);

    if (cobertura.decadas.length > 0) {
      y = this.pdfSection(doc, 'Cobertura por Década', y, onNewPage);
      y = this.pdfTable(doc, ['Década', 'Total Egresados'],
        cobertura.decadas.map(d => [d.etiqueta, String(d.total)]),
        [300, 150], MARGIN_X, y, onNewPage);
    }

    // 2) Resumen
    y = this.pdfSection(doc, 'Resumen', y, onNewPage);
    y = this.pdfTable(doc, ['Indicador', 'Valor'], [
      ['Total Egresados', this.val(k.total_egresados)],
      ['Consintieron', this.val(k.consintieron)],
      ['No Consintieron', this.val(k.no_consintieron)],
      ['Personas con Discapacidad', this.val(k.personas_con_discapacidad)],
      ['Se Consideran Indígenas', this.val(k.se_consideran_indigenas)],
      ['Hablan Lengua Indígena', this.val(k.hablan_lengua_indigena)],
      ['Se Consideran Afromexicanos', this.val(k.se_consideran_afromexicanos)],
      ['Nacidos Fuera de México', this.val(k.nacidos_fuera_de_mexico)],
    ], [300, 150], MARGIN_X, y, onNewPage);

    // 3) Discapacidad por dominio
    const dominios = discapacidad.datos as { dominio: string; pregunta: string; grados: { descripcion: string; total: number | null }[] }[];
    if (dominios.length > 0) {
      y = this.pdfSection(doc, 'Discapacidad por Dominio', y, onNewPage, 30);
      const headers = ['Dominio', ...dominios[0].grados.map(g => g.descripcion)];
      const colWidths = [200, ...dominios[0].grados.map(() => (780 - 200) / dominios[0].grados.length)];
      y = this.pdfTable(doc, headers,
        dominios.map(d => [d.pregunta, ...d.grados.map(g => this.val(g.total))]),
        colWidths, MARGIN_X, y, onNewPage, undefined, 30);
    }

    // 4) Identidad por pregunta
    const preguntas = identidad.datos as { pregunta: string; respuestas: { descripcion: string; total: number | null }[] }[];
    if (preguntas.length > 0) {
      y = this.pdfSection(doc, 'Identidad por Pregunta', y, onNewPage, 30);
      const headers = ['Pregunta', ...preguntas[0].respuestas.map(r => r.descripcion)];
      const primeraColAncho = 360;
      const restoAncho = (780 - primeraColAncho) / preguntas[0].respuestas.length;
      const colWidths = [primeraColAncho, ...preguntas[0].respuestas.map(() => restoAncho)];
      y = this.pdfTable(doc, headers,
        preguntas.map(p => [p.pregunta, ...p.respuestas.map(r => this.val(r.total))]),
        colWidths, MARGIN_X, y, onNewPage, undefined, 30);
    }

    const lenguas = identidad.lengua_indigena as { lengua: string; total: number }[];
    if (lenguas.length > 0) {
      y = this.pdfSection(doc, 'Lenguas Indígenas Habladas', y, onNewPage);
      y = this.pdfTable(doc, ['Lengua', 'Total'],
        lenguas.map(l => [l.lengua, String(l.total)]),
        [300, 150], MARGIN_X, y, onNewPage);
    }

    // 5) Detalle por carrera
    const carreras = porCarrera.datos as { carrera: string; consintieron: number; personas_con_discapacidad: number | null; se_consideran_indigenas: number | null; se_consideran_afromexicanos: number | null }[];
    y = this.pdfSection(doc, 'Detalle por Carrera', y, onNewPage);
    y = this.pdfTable(doc, ['Carrera', 'Consintieron', 'Discapacidad', 'Indígena', 'Afromexicano'],
      carreras.map(c => [c.carrera, String(c.consintieron), this.val(c.personas_con_discapacidad), this.val(c.se_consideran_indigenas), this.val(c.se_consideran_afromexicanos)]),
      [300, 100, 130, 130, 130], MARGIN_X, y, onNewPage);

    // 6) Detalle por año de egreso
    const anios = porAnio.datos as { anio_egreso: number; consintieron: number; personas_con_discapacidad: number | null; se_consideran_indigenas: number | null; se_consideran_afromexicanos: number | null }[];
    y = this.pdfSection(doc, 'Detalle por Año de Egreso', y, onNewPage);
    y = this.pdfTable(doc, ['Año', 'Consintieron', 'Discapacidad', 'Indígena', 'Afromexicano'],
      anios.map(a => [String(a.anio_egreso), String(a.consintieron), this.val(a.personas_con_discapacidad), this.val(a.se_consideran_indigenas), this.val(a.se_consideran_afromexicanos)]),
      [300, 100, 130, 130, 130], MARGIN_X, y, onNewPage);

    this.pdfFooterAllPages(doc, fecha);
    doc.end();
    return bufPromise;
  }

  // EXPORT EXCEL

  async exportarInclusionExcel(): Promise<Buffer> {
    const { resumen, discapacidad, identidad, porCarrera, porAnio } = await this.recolectarDatos();
    const fecha = this.fechaStr();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema de Seguimiento de Egresados';
    wb.created = new Date();

    const k = resumen.datos as any;
    const cobertura = k.cobertura as { anio_min: number | null; anio_max: number | null; decadas: { etiqueta: string; desde: number; hasta: number; total: number }[] };
    const periodo = this.periodoStr(cobertura.anio_min, cobertura.anio_max);

    const addSheet = (name: string, cols: number, title: string): ExcelJS.Worksheet => {
      const ws = wb.addWorksheet(name, { pageSetup: { orientation: 'landscape', fitToPage: true }, views: [{ state: 'frozen', ySplit: 5 }] });
      this.excelHeader(ws, title, periodo, cols, fecha, resumen.nota);
      return ws;
    };

    // 1) Cobertura por década
    {
      const ws = addSheet('Cobertura', 2, 'Inclusión y Diversidad — Cobertura por Década');
      ws.columns = [{ key: 'd', width: 20 }, { key: 't', width: 20 }];
      this.excelTable(ws, ['Década', 'Total Egresados'], cobertura.decadas.map(d => [d.etiqueta, d.total]), 5);
    }

    // 2) Resumen
    {
      const ws = addSheet('Resumen', 2, 'Resumen');
      ws.columns = [{ key: 'ind', width: 34 }, { key: 'val', width: 18 }];
      this.excelTable(ws, ['Indicador', 'Valor'], [
        ['Total Egresados', this.valNum(k.total_egresados)],
        ['Consintieron', this.valNum(k.consintieron)],
        ['No Consintieron', this.valNum(k.no_consintieron)],
        ['Personas con Discapacidad', this.valNum(k.personas_con_discapacidad)],
        ['Se Consideran Indígenas', this.valNum(k.se_consideran_indigenas)],
        ['Hablan Lengua Indígena', this.valNum(k.hablan_lengua_indigena)],
        ['Se Consideran Afromexicanos', this.valNum(k.se_consideran_afromexicanos)],
        ['Nacidos Fuera de México', this.valNum(k.nacidos_fuera_de_mexico)],
      ], 5);
    }

    // 3) Discapacidad por dominio
    const dominios = discapacidad.datos as { dominio: string; pregunta: string; grados: { descripcion: string; total: number | null }[] }[];
    if (dominios.length > 0) {
      const cols = 1 + dominios[0].grados.length;
      const ws = addSheet('Discapacidad', cols, 'Discapacidad por Dominio');
      ws.columns = [{ key: 'dominio', width: 34 }, ...dominios[0].grados.map((_, i) => ({ key: `g${i}`, width: 20 }))];
      this.excelTable(ws, ['Dominio', ...dominios[0].grados.map(g => g.descripcion)],
        dominios.map(d => [d.pregunta, ...d.grados.map(g => this.valNum(g.total))]), 5);
    }

    // 4) Identidad por pregunta + lenguas
    const preguntas = identidad.datos as { pregunta: string; respuestas: { descripcion: string; total: number | null }[] }[];
    if (preguntas.length > 0) {
      const cols = 1 + preguntas[0].respuestas.length;
      const ws = addSheet('Identidad', cols, 'Identidad por Pregunta');
      ws.columns = [{ key: 'pregunta', width: 50 }, ...preguntas[0].respuestas.map((_, i) => ({ key: `r${i}`, width: 20 }))];
      this.excelTable(ws, ['Pregunta', ...preguntas[0].respuestas.map(r => r.descripcion)],
        preguntas.map(p => [p.pregunta, ...p.respuestas.map(r => this.valNum(r.total))]), 5);
    }

    const lenguas = identidad.lengua_indigena as { lengua: string; total: number }[];
    if (lenguas.length > 0) {
      const ws = addSheet('Lenguas', 2, 'Lenguas Indígenas Habladas');
      ws.columns = [{ key: 'lengua', width: 34 }, { key: 't', width: 18 }];
      this.excelTable(ws, ['Lengua', 'Total'], lenguas.map(l => [l.lengua, l.total]), 5);
    }

    // 5) Detalle por carrera
    {
      const carreras = porCarrera.datos as { carrera: string; consintieron: number; personas_con_discapacidad: number | null; se_consideran_indigenas: number | null; se_consideran_afromexicanos: number | null }[];
      const ws = addSheet('Por Carrera', 5, 'Detalle por Carrera');
      ws.columns = [{ key: 'c', width: 40 }, { key: 'consintieron', width: 16 }, { key: 'disc', width: 18 }, { key: 'ind', width: 18 }, { key: 'afro', width: 18 }];
      this.excelTable(ws, ['Carrera', 'Consintieron', 'Discapacidad', 'Indígena', 'Afromexicano'],
        carreras.map(c => [c.carrera, this.valNum(c.consintieron), this.valNum(c.personas_con_discapacidad), this.valNum(c.se_consideran_indigenas), this.valNum(c.se_consideran_afromexicanos)]), 5);
    }

    // 6) Detalle por año de egreso
    {
      const anios = porAnio.datos as { anio_egreso: number; consintieron: number; personas_con_discapacidad: number | null; se_consideran_indigenas: number | null; se_consideran_afromexicanos: number | null }[];
      const ws = addSheet('Por Año', 5, 'Detalle por Año de Egreso');
      ws.columns = [{ key: 'a', width: 14 }, { key: 'consintieron', width: 16 }, { key: 'disc', width: 18 }, { key: 'ind', width: 18 }, { key: 'afro', width: 18 }];
      this.excelTable(ws, ['Año', 'Consintieron', 'Discapacidad', 'Indígena', 'Afromexicano'],
        anios.map(a => [a.anio_egreso, this.valNum(a.consintieron), this.valNum(a.personas_con_discapacidad), this.valNum(a.se_consideran_indigenas), this.valNum(a.se_consideran_afromexicanos)]), 5);
    }

    return this.toBuffer(wb);
  }
}
