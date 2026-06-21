const PDFDocument = require('pdfkit');

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExportEgresadosDto } from '../dto/export-egresados.dto';
import * as ExcelJS from 'exceljs';

const COLOR_VINO = '#7B1C45';
const COLOR_VINO_ARG = 'FF6b1232';
const COLOR_ALT_ARG = 'FFFDF2F6';

@Injectable()
export class ExportService {

    constructor(private readonly dataSource: DataSource) { }

    // Consulta filtrada
    private async getEgresadosFiltrados(filtros: ExportEgresadosDto): Promise<any[]> {
        const params: any[] = [];
        const conditions: string[] = ['1=1'];

        if (filtros.nombre) {
            conditions.push(`e.nombre_completo LIKE ?`);
            params.push(`%${filtros.nombre}%`);
        }
        if (filtros.empresa) {
            conditions.push(`e.empresa LIKE ?`);
            params.push(`%${filtros.empresa}%`);
        }
        if (filtros.carrera) {
            conditions.push(`c.nombre_carrera = ?`);
            params.push(filtros.carrera);
        }
        if (filtros.anio) {
            conditions.push(`e.anio_egreso = ?`);
            params.push(Number(filtros.anio));
        }
        if (filtros.situacion_laboral) {
            conditions.push(`sl.situacion = ?`);
            params.push(filtros.situacion_laboral);
        }
        if (filtros.estatus_titulacion) {
            conditions.push(`e.estatus_titulacion = ?`);
            params.push(filtros.estatus_titulacion);
        }
        if (filtros.autorizo_contacto !== undefined) {
            conditions.push(`aut.autorizo_contacto = ?`);
            params.push(filtros.autorizo_contacto ? 1 : 0);
        }
        if (filtros.autorizo_eventos !== undefined) {
            conditions.push(`aut.autorizo_eventos = ?`);
            params.push(filtros.autorizo_eventos ? 1 : 0);
        }
        if (filtros.autorizo_estadisticas !== undefined) {
            conditions.push(`aut.autorizo_estadisticas = ?`);
            params.push(filtros.autorizo_estadisticas ? 1 : 0);
        }

        const where = `WHERE ${conditions.join(' AND ')}`;

        return this.dataSource.query(`
      SELECT
        e.id_egresado,
        e.nombre_completo,
        e.numero_control,
        e.correo,
        e.telefono,
        e.ciudad_residencia,
        e.anio_egreso,
        e.empresa,
        e.puesto_trabajo,
        e.ciudad_trabajo,
        e.estatus_titulacion,
        e.satisfaccion_formacion,
        c.nombre_carrera,
        ni.nivel        AS nivel_ingles,
        sl.situacion    AS situacion_laboral,
        ae.rango        AS antiguedad_empleo,
        cl.nivel        AS coincidencia_laboral,
        aut.autorizo_estadisticas,
        aut.autorizo_contacto,
        aut.autorizo_eventos
      FROM egresados e
      LEFT JOIN carreras             c   ON e.carrera_id              = c.id_carrera
      LEFT JOIN niveles_ingles       ni  ON e.nivel_ingles_id         = ni.id_nivel
      LEFT JOIN situacion_laboral    sl  ON e.situacion_laboral_id    = sl.id_situacion
      LEFT JOIN antiguedad_empleo    ae  ON e.antiguedad_empleo_id    = ae.id_antiguedad
      LEFT JOIN coincidencia_laboral cl  ON e.coincidencia_laboral_id = cl.id_coincidencia
      LEFT JOIN autorizaciones       aut ON e.id_egresado             = aut.id_egresado
      ${where}
      ORDER BY e.nombre_completo ASC
    `, params);
    }

    // Descripción de filtros
    private describeFiltros(filtros: ExportEgresadosDto): string {
        const partes: string[] = [];
        if (filtros.nombre) partes.push(`Nombre: "${filtros.nombre}"`);
        if (filtros.empresa) partes.push(`Empresa: "${filtros.empresa}"`);
        if (filtros.carrera) partes.push(`Carrera: ${filtros.carrera}`);
        if (filtros.anio) partes.push(`Año: ${filtros.anio}`);
        if (filtros.situacion_laboral) partes.push(`Situación: ${filtros.situacion_laboral}`);
        if (filtros.estatus_titulacion) partes.push(`Titulación: ${filtros.estatus_titulacion}`);
        if (filtros.autorizo_contacto !== undefined)
            partes.push(`Contacto: ${filtros.autorizo_contacto ? 'Autorizado' : 'No autorizado'}`);
        if (filtros.autorizo_eventos !== undefined)
            partes.push(`Eventos: ${filtros.autorizo_eventos ? 'Autorizado' : 'No autorizado'}`);
        if (filtros.autorizo_estadisticas !== undefined)
            partes.push(`Estadísticas: ${filtros.autorizo_estadisticas ? 'Autorizado' : 'No autorizado'}`);

        return partes.length > 0 ? partes.join('  |  ') : 'Sin filtros — mostrando todos los egresados';
    }

    async exportarPdf(filtros: ExportEgresadosDto): Promise<Buffer> {
        const egresados = await this.getEgresadosFiltrados(filtros);

        const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margins: { top: 50, bottom: 40, left: 28, right: 28 },
            });

            const chunks: Buffer[] = [];
            doc.on('data', (c: Buffer) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const VINO = '#6b1232';   // ← color actualizado
            const GRIS = '#6B7280';
            const NEGRO = '#1F2937';
            const W = 791;
            const COL = [18, 140, 100, 34, 110, 96, 58, 72, 44, 44, 54];
            const ROW_H = 32;          // ← más alto para que respire el texto
            const HDR_H = 20;

            // ── Header ──────────────────────────────────────────────────────────
            doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold')
                .text('Sistema de Seguimiento de Egresados', 28, 18, { continued: true })
                .fillColor(GRIS).font('Helvetica').fontSize(8)
                .text('Página 1', { align: 'right' });

            // ── Título en NEGRO ──────────────────────────────────────────────────
            doc.fontSize(15).fillColor('#111827').font('Helvetica-Bold')
                .text('Reporte de Egresados', 28, 42);

            doc.fontSize(7.5).fillColor(GRIS).font('Helvetica')
                .text(`Filtros aplicados: ${this.describeFiltros(filtros)}`, 28, 62);

            // ── Encabezados de tabla ─────────────────────────────────────────────
            const HEADERS = [
                '#', 'Nombre', 'Carrera', 'Año', 'Empresa',
                'Situación Laboral', 'Titulación', 'Inglés',
                'Contacto', 'Eventos', 'Estadísticas',
            ];

            let y = 80;

            doc.rect(28, y, W, HDR_H).fill(VINO);

            let x = 28;
            HEADERS.forEach((h, idx) => {
                doc.fontSize(7.5).fillColor('#FFFFFF').font('Helvetica-Bold')
                    .text(h, x + 2, y + 5, {
                        width: COL[idx] - 4,
                        align: 'center',
                        lineBreak: false,
                    });
                x += COL[idx];
            });
            y += HDR_H;

            // ── Filas de datos ───────────────────────────────────────────────────
            egresados.forEach((e, index) => {

                if (index % 2 === 0) {
                    doc.rect(28, y, W, ROW_H).fill('#FDF2F6');
                }

                doc.moveTo(28, y).lineTo(28 + W, y)
                    .strokeColor('#E5E7EB').lineWidth(0.4).stroke();

                const valores = [
                    String(index + 1),
                    e.nombre_completo ?? '—',
                    e.nombre_carrera ?? '—',
                    String(e.anio_egreso),
                    e.empresa || '—',
                    e.situacion_laboral ?? '—',
                    e.estatus_titulacion ?? '—',
                    e.nivel_ingles ?? '—',
                    e.autorizo_contacto ? 'Si' : 'No',
                    e.autorizo_eventos ? 'Si' : 'No',
                    e.autorizo_estadisticas ? 'Si' : 'No',
                ];

                // Columnas que permiten salto de línea (carrera=2, empresa=4, situacion=5)
                const MULTILINEA = new Set([1, 2, 4, 5, 6, 7]);

                x = 28;
                valores.forEach((val, idx) => {
                    let color = NEGRO;
                    if (idx >= 8) color = val === 'Si' ? '#16A34A' : '#DC2626';

                    const esMultilinea = MULTILINEA.has(idx);

                    doc.fontSize(7).fillColor(color).font('Helvetica')
                        .text(val, x + 3, y + 4, {
                            width: COL[idx] - 6,
                            align: idx === 0 || idx === 3 || idx >= 8 ? 'center' : 'left',
                            lineBreak: esMultilinea,   // ← permite wrap en columnas anchas
                            ellipsis: !esMultilinea,  // ← ellipsis solo en cols fijas
                            height: ROW_H - 6,      // ← limita al alto de la fila
                        });
                    x += COL[idx];
                });

                y += ROW_H;

                // ── Nueva página ─────────────────────────────────────────────────
                if (y > 530) {
                    doc.addPage({
                        size: 'A4',
                        layout: 'landscape',
                        margins: { top: 50, bottom: 40, left: 28, right: 28 },
                    });

                    doc.fontSize(9).fillColor(VINO).font('Helvetica-Bold')
                        .text('Sistema de Seguimiento de Egresados', 28, 18);

                    y = 40;
                    doc.rect(28, y, W, HDR_H).fill(VINO);
                    x = 28;
                    HEADERS.forEach((h, idx) => {
                        doc.fontSize(7.5).fillColor('#FFFFFF').font('Helvetica-Bold')
                            .text(h, x + 2, y + 5, {
                                width: COL[idx] - 4,
                                align: 'center',
                                lineBreak: false,
                            });
                        x += COL[idx];
                    });
                    y += HDR_H;
                }
            });

            // ── Footer ───────────────────────────────────────────────────────────
            doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica')
                .text(`Generado el ${fechaGeneracion}`, 28, 570, { continued: true })
                .text(`Total de registros: ${egresados.length}`, { align: 'right' });

            doc.end();
        });
    }

    // EXPORTAR EXCEL
    async exportarExcel(filtros: ExportEgresadosDto): Promise<Buffer> {
        const egresados = await this.getEgresadosFiltrados(filtros);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Seguimiento de Egresados';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Egresados', {
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
            views: [{ state: 'frozen', ySplit: 4 }],
        });

        // Fila 1 — título
        sheet.mergeCells('A1:K1');
        const t = sheet.getCell('A1');
        t.value = 'Reporte de Egresados — Sistema de Seguimiento';
        t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VINO_ARG } };
        t.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 30;

        // Fila 2 — filtros
        sheet.mergeCells('A2:K2');
        const f = sheet.getCell('A2');
        f.value = `Filtros: ${this.describeFiltros(filtros)}`;
        f.font = { italic: true, size: 8.5, color: { argb: 'FF6B7280' } };
        f.alignment = { horizontal: 'left', vertical: 'middle' };
        sheet.getRow(2).height = 16;

        // Fila 3 — fecha y total
        sheet.mergeCells('A3:K3');
        const i = sheet.getCell('A3');
        i.value = `Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}   |   Total de registros: ${egresados.length}`;
        i.font = { size: 8, color: { argb: 'FF9CA3AF' } };
        i.alignment = { horizontal: 'left', vertical: 'middle' };
        sheet.getRow(3).height = 14;

        // Columnas
        sheet.columns = [
            { key: 'num', width: 5 },
            { key: 'nombre', width: 32 },
            { key: 'carrera', width: 26 },
            { key: 'anio', width: 10 },
            { key: 'empresa', width: 28 },
            { key: 'situacion', width: 24 },
            { key: 'titulacion', width: 14 },
            { key: 'ingles', width: 18 },
            { key: 'contacto', width: 12 },
            { key: 'eventos', width: 12 },
            { key: 'estadisticas', width: 14 },
        ];

        // Fila 4 — encabezados
        const HEADERS = [
            '#', 'Nombre', 'Carrera', 'Año de Egreso', 'Empresa',
            'Situación Laboral', 'Titulación', 'Nivel de Inglés',
            'Contacto', 'Eventos', 'Estadísticas',
        ];
        const headerRow = sheet.getRow(4);
        HEADERS.forEach((h, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_VINO_ARG } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        });
        headerRow.height = 22;

        // Filas de datos
        egresados.forEach((e, index) => {
            const row = sheet.addRow({
                num: index + 1,
                nombre: e.nombre_completo,
                carrera: e.nombre_carrera ?? '—',
                anio: e.anio_egreso,
                empresa: e.empresa || '—',
                situacion: e.situacion_laboral ?? '—',
                titulacion: e.estatus_titulacion ?? '—',
                ingles: e.nivel_ingles ?? '—',
                contacto: e.autorizo_contacto ? 'Sí' : 'No',
                eventos: e.autorizo_eventos ? 'Sí' : 'No',
                estadisticas: e.autorizo_estadisticas ? 'Sí' : 'No',
            });

            const bg = index % 2 === 0 ? COLOR_ALT_ARG : 'FFFFFFFF';

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.font = { size: 9 };
                cell.alignment = { vertical: 'middle' };
                cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };

                if (colNumber >= 9) {
                    const esSi = cell.value === 'Sí';
                    cell.font = { bold: true, size: 9, color: { argb: esSi ? 'FF16A34A' : 'FFDC2626' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
                if (colNumber === 1 || colNumber === 4) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            });

            row.height = 18;
        });

        // Fila de total
        sheet.addRow({});
        const totalRow = sheet.addRow({ nombre: `Total de egresados exportados: ${egresados.length}` });
        totalRow.getCell(2).font = { bold: true, size: 9, color: { argb: COLOR_VINO_ARG } };

        // Autofilter
        sheet.autoFilter = { from: 'A4', to: 'K4' };

        // ← Fix del error de tipo: writeBuffer devuelve ArrayBuffer, lo convertimos a Buffer
        const arrayBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }

    // ─── EXPORTAR PERFIL INDIVIDUAL ───────────────────────────────────────────
    async exportarPerfilPdf(id: number): Promise<Buffer> {
        const fs = require('fs');
        const path = require('path');

        const rows = await this.dataSource.query(`
            SELECT
                e.nombre_completo, e.correo, e.telefono, e.ciudad_residencia,
                e.anio_egreso, e.empresa, e.ciudad_trabajo, e.numero_control,
                e.linkedin, e.puesto_trabajo, e.estatus_titulacion,
                e.satisfaccion_formacion, e.foto_url,
                e.facebook, e.instagram,
                e.medio_primer_empleo_otro,
                g.genero,
                c.nombre_carrera,
                ni.nivel        AS nivel_ingles,
                ae.rango        AS antiguedad_empleo,
                cl.nivel        AS coincidencia_laboral,
                sl.situacion    AS situacion_laboral,
                cv.respuesta    AS certificacion_vigente,
                tpe.rango       AS tiempo_primer_empleo,
                mpe.medio       AS medio_primer_empleo,
                aut.autorizo_estadisticas,
                aut.autorizo_contacto,
                aut.autorizo_eventos
            FROM egresados e
            LEFT JOIN generos                  g   ON e.genero_id               = g.id_genero
            LEFT JOIN carreras                 c   ON e.carrera_id              = c.id_carrera
            LEFT JOIN niveles_ingles           ni  ON e.nivel_ingles_id         = ni.id_nivel
            LEFT JOIN antiguedad_empleo        ae  ON e.antiguedad_empleo_id    = ae.id_antiguedad
            LEFT JOIN coincidencia_laboral     cl  ON e.coincidencia_laboral_id = cl.id_coincidencia
            LEFT JOIN situacion_laboral        sl  ON e.situacion_laboral_id    = sl.id_situacion
            LEFT JOIN certificaciones_vigentes cv  ON e.certificacion_vigente_id = cv.id_certificacion_vigente
            LEFT JOIN tiempo_primer_empleo     tpe ON e.tiempo_primer_empleo_id = tpe.id_tiempo
            LEFT JOIN medio_primer_empleo      mpe ON e.medio_primer_empleo_id  = mpe.id_medio
            LEFT JOIN autorizaciones           aut ON e.id_egresado             = aut.id_egresado
            WHERE e.id_egresado = ?
            `, [id]);

        if (!rows.length) throw new Error(`Egresado ${id} no encontrado`);
        const e = rows[0];

        // Si eligió "Otra", usamos el texto libre en lugar de la etiqueta del catálogo
        const medioPrimerEmpleo =
            e.medio_primer_empleo === 'Otra' && e.medio_primer_empleo_otro
                ? e.medio_primer_empleo_otro
                : e.medio_primer_empleo;

        const certificaciones = await this.dataSource.query(
            `SELECT nombre_certificacion FROM certificaciones WHERE id_egresado = ?`, [id],
        );
        const habilidades = await this.dataSource.query(`
    SELECT h.habilidad FROM egresado_habilidades eh
    JOIN habilidades h ON eh.id_habilidad = h.id_habilidad
    WHERE eh.id_egresado = ?
  `, [id]);
        const habilidadesOtro = await this.dataSource.query(
            `SELECT descripcion FROM habilidades_otro WHERE id_egresado = ?`, [id],
        );
        const colaboraciones = await this.dataSource.query(`
    SELECT c.descripcion FROM egresado_colaboraciones ec
    JOIN colaboraciones c ON ec.id_colaboracion = c.id_colaboracion
    WHERE ec.id_egresado = ?
  `, [id]);
        const colaboracionesOtro = await this.dataSource.query(
            `SELECT descripcion FROM colaboracion_otro WHERE id_egresado = ?`, [id],
        );

        const todasHabilidades: string[] = [
            ...habilidades.map((h: any) => h.habilidad),
            ...habilidadesOtro.map((h: any) => h.descripcion),
        ];
        const todasColaboraciones: string[] = [
            ...colaboraciones.map((c: any) => c.descripcion),
            ...colaboracionesOtro.map((c: any) => c.descripcion),
        ];
        const todasCertificaciones: string[] = certificaciones.map((c: any) => c.nombre_certificacion);

        const fecha = new Date().toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        const VINO = '#6b1232';
        const GRIS = '#6B7280';
        const NEGRO = '#111827';
        const W = 535;
        const BANDA = 100; // altura banda superior (un poco más alta para foto)

        const authLabel = (val: any) => val ? 'Autorizado' : 'No autorizado';
        const authColor = (val: any) => val ? '#16A34A' : '#DC2626';

        // Estrellas con caracteres ASCII seguros para PDFKit
        const estrellaStr = (n: number): string => {
            const llenas = Math.round(n);
            return '* '.repeat(llenas).trim();
        };

        // Cargar foto de perfil — soporta data URI, Base64 puro (Railway/LONGTEXT) o ruta en disco
        let fotoBuffer: Buffer | null = null;
        if (e.foto_url) {
            try {
                const foto: string = String(e.foto_url).trim();

                if (foto.startsWith('data:')) {
                    // Caso 1 — data URI: data:image/png;base64,iVBORw0KG...
                    const base64 = foto.substring(foto.indexOf(',') + 1);
                    fotoBuffer = Buffer.from(base64, 'base64');
                } else if (foto.length < 500 && /\.(jpe?g|png|webp|gif)$/i.test(foto)) {
                    // Caso 2 — ruta de archivo en disco (entorno local)
                    const fotoPath = path.join(process.cwd(), foto);
                    if (fs.existsSync(fotoPath)) {
                        fotoBuffer = fs.readFileSync(fotoPath);
                    }
                } else {
                    // Caso 3 — Base64 puro sin prefijo (columna LONGTEXT en Railway)
                    fotoBuffer = Buffer.from(foto, 'base64');
                }
            } catch (err) {
                console.error('No se pudo cargar la foto de perfil del egresado:', err);
                fotoBuffer = null;
            }
        }

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'portrait',
                margins: { top: 40, bottom: 40, left: 40, right: 40 },
            });

            const chunks: Buffer[] = [];
            doc.on('data', (c: Buffer) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // ── Banda superior ───────────────────────────────────────────────────────
            doc.rect(0, 0, 595, BANDA).fill(VINO);

            // Foto de perfil (círculo recortado con clip)
            const FOTO_SIZE = 60;
            const FOTO_X = 40;
            const FOTO_Y = 18;

            if (fotoBuffer) {
                try {
                    // Clip circular + cover para que la foto llene el círculo sin deformarse
                    doc.save();
                    doc.circle(FOTO_X + FOTO_SIZE / 2, FOTO_Y + FOTO_SIZE / 2, FOTO_SIZE / 2).clip();
                    doc.image(fotoBuffer, FOTO_X, FOTO_Y, {
                        cover: [FOTO_SIZE, FOTO_SIZE],
                        align: 'center',
                        valign: 'center',
                    });
                    doc.restore();
                } catch (err) {
                    doc.restore();
                    console.error('PDFKit no pudo renderizar la foto (¿formato no soportado?):', err);
                    fotoBuffer = null; // así el texto no se desplaza a la derecha si la imagen falló
                }
            }

            // Texto desplazado a la derecha si hay foto
            const textoX = fotoBuffer ? FOTO_X + FOTO_SIZE + 12 : 40;
            const textoW = fotoBuffer ? W - FOTO_SIZE - 12 : W;

            // Nombre
            doc.fontSize(15).fillColor('#FFFFFF').font('Helvetica-Bold')
                .text(e.nombre_completo, textoX, 20, { width: textoW });

            // Empresa · Puesto
            const subLinea = [e.empresa, e.puesto_trabajo].filter(Boolean).join(' · ');
            doc.fontSize(8.5).fillColor('rgba(255,255,255,0.85)').font('Helvetica')
                .text(subLinea || '—', textoX, 44, { width: textoW });

            // Situación | Titulación
            doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica')
                .text(`${e.situacion_laboral || '—'}   |   ${e.estatus_titulacion || '—'}`, textoX, 62, { width: textoW });

            // Institución (esquina derecha)
            doc.fontSize(7).fillColor('rgba(255,255,255,0.65)').font('Helvetica')
                .text('Sistema de Seguimiento de Egresados', 40, 86, { align: 'right', width: W });

            // ── Contenido ────────────────────────────────────────────────────────────
            let y = BANDA + 16;

            const LIMITE_Y = 760; // deja aire para el footer (790)

            const nuevaPaginaSiHaceFalta = (alto: number) => {
                if (y + alto > LIMITE_Y) {
                    doc.addPage({
                        size: 'A4',
                        layout: 'portrait',
                        margins: { top: 40, bottom: 40, left: 40, right: 40 },
                    });
                    y = 50; // arranque de contenido en páginas siguientes (sin banda)
                }
            };

            const seccion = (titulo: string) => {
                nuevaPaginaSiHaceFalta(46); // evita títulos huérfanos al final de página
                doc.fontSize(7).fillColor(VINO).font('Helvetica-Bold')
                    .text(titulo.toUpperCase(), 40, y, { width: W, characterSpacing: 0.8 });
                y += 13;
                doc.moveTo(40, y).lineTo(40 + W, y)
                    .strokeColor('#E5E7EB').lineWidth(0.5).stroke();
                y += 8;
            };

            const campo = (label: string, valor: string, col: 'left' | 'right' = 'left') => {
                const xPos = col === 'left' ? 40 : 40 + W / 2 + 10;
                const wCol = W / 2 - 10;
                doc.fontSize(7).fillColor(GRIS).font('Helvetica').text(label, xPos, y, { width: wCol });
                doc.fontSize(8.5).fillColor(NEGRO).font('Helvetica')
                    .text(valor || '—', xPos, y + 10, { width: wCol });
            };

            const campoFull = (label: string, valor: string) => {
                nuevaPaginaSiHaceFalta(28);
                doc.fontSize(7).fillColor(GRIS).font('Helvetica').text(label, 40, y, { width: W });
                doc.fontSize(8.5).fillColor(NEGRO).font('Helvetica')
                    .text(valor || '—', 40, y + 10, { width: W });
                y += 28;
            };

            const filaDos = (l1: string, v1: string, l2: string, v2: string) => {
                nuevaPaginaSiHaceFalta(28);
                campo(l1, v1, 'left');
                campo(l2, v2, 'right');
                y += 28;
            };

            // ── DATOS PERSONALES ─────────────────────────────────────────────────────
            seccion('Datos personales');
            filaDos('No. de control', e.numero_control || '—', 'Año de egreso', String(e.anio_egreso));
            campoFull('Correo electrónico', e.correo || '—');
            filaDos('Teléfono', e.telefono || '—', 'Ciudad de residencia', e.ciudad_residencia || '—');
            if (e.linkedin) campoFull('LinkedIn', e.linkedin);
            if (e.facebook) campoFull('Facebook', e.facebook);
            if (e.instagram) campoFull('Instagram', e.instagram);
            y += 4;

            // ── DATOS ACADÉMICOS ─────────────────────────────────────────────────────
            seccion('Datos académicos');
            campoFull('Carrera', e.nombre_carrera || '—');
            filaDos('Nivel de inglés', e.nivel_ingles || '—', 'Titulación', e.estatus_titulacion || '—');

            // Satisfacción — reemplazamos unicode por texto seguro
            const nEstrellas = Math.round(e.satisfaccion_formacion || 0);
            doc.fontSize(7).fillColor(GRIS).font('Helvetica')
                .text('Satisfacción con la formación', 40, y, { width: W });
            const estrellasTexto = estrellaStr(nEstrellas);
            doc.fontSize(8).fillColor('#F59E0B').font('Helvetica-Bold')
                .text(estrellasTexto, 40, y + 10, { width: 80, continued: true });
            doc.fillColor(NEGRO).font('Helvetica')
                .text(`  ${e.satisfaccion_formacion || 0} / 5`);
            y += 30;
            y += 4;

            // ── CERTIFICACIONES ──────────────────────────────────────────────────────
            seccion('Certificaciones');
            campoFull('Cuenta con certificación vigente', e.certificacion_vigente || '—');
            if (todasCertificaciones.length > 0) {
                nuevaPaginaSiHaceFalta(25);
                doc.fontSize(7).fillColor(GRIS).font('Helvetica')
                    .text('Certificaciones obtenidas', 40, y, { width: W });
                y += 12;
                todasCertificaciones.forEach(cert => {
                    nuevaPaginaSiHaceFalta(13);
                    doc.fontSize(8).fillColor(NEGRO).font('Helvetica')
                        .text(`- ${cert}`, 44, y, { width: W - 4 });
                    y += 13;
                });
            }
            y += 4;

            // ── SITUACIÓN LABORAL ────────────────────────────────────────────────────
            seccion('Situación laboral');
            campoFull('Empresa', e.empresa || '—');
            campoFull('Puesto', e.puesto_trabajo || '—');
            filaDos('Ciudad de trabajo', e.ciudad_trabajo || '—', 'Antigüedad', e.antiguedad_empleo || '—');
            campoFull('Coincidencia con carrera', e.coincidencia_laboral || '—');
            campoFull('Tiempo en conseguir el primer empleo', e.tiempo_primer_empleo || '—');
            campoFull('Medio para obtener el primer empleo', medioPrimerEmpleo || '—');
            y += 4;

            // ── HABILIDADES ──────────────────────────────────────────────────────────
            if (todasHabilidades.length > 0) {
                seccion('Habilidades a reforzar');
                todasHabilidades.forEach(hab => {
                    nuevaPaginaSiHaceFalta(13);
                    doc.fontSize(8).fillColor(NEGRO).font('Helvetica')
                        .text(`- ${hab}`, 44, y, { width: W - 4 });
                    y += 13;
                });
                y += 4;
            }

            // ── COLABORACIONES ───────────────────────────────────────────────────────
            if (todasColaboraciones.length > 0) {
                seccion('Interés en colaborar');
                todasColaboraciones.forEach(col => {
                    nuevaPaginaSiHaceFalta(13);
                    doc.fontSize(8).fillColor(NEGRO).font('Helvetica')
                        .text(`- ${col}`, 44, y, { width: W - 4 });
                    y += 13;
                });
                y += 4;
            }

            // ── AUTORIZACIONES ───────────────────────────────────────────────────────
            seccion('Autorizaciones');
            const auths = [
                { label: 'Estadísticas', val: e.autorizo_estadisticas },
                { label: 'Contacto', val: e.autorizo_contacto },
                { label: 'Eventos', val: e.autorizo_eventos },
            ];
            auths.forEach(a => {
                nuevaPaginaSiHaceFalta(20);
                doc.fontSize(8.5).fillColor(NEGRO).font('Helvetica')
                    .text(a.label, 40, y, { continued: true, width: 200 });
                doc.fillColor(authColor(a.val)).font('Helvetica-Bold')
                    .text(authLabel(a.val), { align: 'right' });
                doc.moveTo(40, y + 14).lineTo(40 + W, y + 14)
                    .strokeColor('#F3F4F6').lineWidth(0.4).stroke();
                y += 20;
            });

            // ── Footer ───────────────────────────────────────────────────────────────
            doc.fontSize(7).fillColor('#9CA3AF').font('Helvetica')
                .text(
                    `Generado el ${fecha} - Sistema de Seguimiento de Egresados`,
                    40, 790, { width: W, align: 'center' },
                );

            doc.end();
        });
    }
}