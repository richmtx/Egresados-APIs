import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReporteHistorial } from './reportes.entity';
import { EgresadosService } from '../egresados/egresados.service';

@Injectable()
export class ReportesService {

    constructor(
        @InjectRepository(ReporteHistorial)
        private reportesRepo: Repository<ReporteHistorial>,
        private egresadosService: EgresadosService,
    ) { }

    // ── CONSOLIDADO DE DATOS ────────────────────────────────────────────────

    private async consolidarDatos(anio?: number, carrera?: string) {
        const [estadisticas, geografia, genero] = await Promise.all([
            this.egresadosService.getEstadisticas(carrera, anio),
            this.egresadosService.getDistribucionGeografica(carrera, anio),
            this.egresadosService.getEstadisticasGenero(carrera, anio),
        ]);

        return { estadisticas, geografia, genero };
    }

    // ── REPORTE TecNM ───────────────────────────────────────────────────────

    async getDatosTecNM(anio?: number, carrera?: string) {
        const datos = await this.consolidarDatos(anio, carrera);

        return {
            organismo: 'TecNM',
            tipo: 'Reporte Anual de Seguimiento de Egresados',
            anio: anio ?? null,
            carrera: carrera ?? 'Todas las carreras',
            secciones: {
                resumenEjecutivo: {
                    totalEgresados: datos.estadisticas.kpis.total_egresados,
                    tasaEmpleabilidad: this.calcularPorcentaje(
                        datos.estadisticas.kpis.empleados,
                        datos.estadisticas.kpis.total_egresados,
                    ),
                    tasaTitulacion: this.calcularPorcentaje(
                        datos.estadisticas.kpis.titulados,
                        datos.estadisticas.kpis.total_egresados,
                    ),
                    satisfaccionPromedio: datos.estadisticas.kpis.satisfaccion_promedio,
                },
                egresadosYTitulacion: {
                    kpis: datos.estadisticas.kpis,
                    titulacionAnio: datos.estadisticas.titulacionAnio,
                    titulacionCarrera: datos.estadisticas.titulacionCarrera,
                    posgrado: {
                        porTipo: datos.estadisticas.posgradoPorTipo,
                        total: datos.estadisticas.totalPosgrado,
                    },
                },
                empleabilidad: {
                    situacionLaboral: datos.estadisticas.situacionLaboral,
                    empleabilidadCarrera: datos.estadisticas.empleabilidadCarrera,
                    topEmpresas: datos.estadisticas.topEmpresas,
                    coincidenciaCarrera: datos.estadisticas.coincidenciaCarrera,
                    tiempoEmpleo: {
                        porCarrera: datos.estadisticas.tiempoEmpleoCarrera,
                        general: datos.estadisticas.tiempoEmpleoGeneral,
                    },
                },
                distribucionGeografica: {
                    kpis: datos.geografia.kpisGeo,
                    topCiudades: datos.geografia.topCiudadesTrabajo,
                    extranjerosPorPais: datos.geografia.extranjerosPorPais,
                    movilidadPorAnio: datos.geografia.movilidadPorAnio,
                    movilidadCarrera: datos.geografia.movilidadPorCarrera,
                },
                genero: {
                    kpis: datos.genero.kpisGenero,
                    composicionCarrera: datos.genero.composicionCarreraGenero,
                    empleabilidad: datos.genero.empleabilidadGenero,
                    titulacion: datos.genero.titulacionGenero,
                },
                vinculacion: {
                    autorizaciones: {
                        contacto: datos.estadisticas.kpis.autorizo_contacto,
                        eventos: datos.estadisticas.kpis.autorizo_eventos,
                    },
                    participacionCarrera: datos.estadisticas.participacionCarrera,
                },
                academico: {
                    nivelesIngles: datos.estadisticas.nivelesIngles,
                    satisfaccionCarrera: datos.estadisticas.satisfaccionCarrera,
                    evolucionGeneracion: datos.estadisticas.evolucionGeneracion,
                },
            },
        };
    }

    // ── REPORTE CACEI ───────────────────────────────────────────────────────

    async getDatosCACEI(anio?: number, carrera?: string) {
        const datos = await this.consolidarDatos(anio, carrera);

        return {
            organismo: 'CACEI',
            tipo: 'Reporte de Seguimiento de Egresados — Criterio 8',
            anio: anio ?? null,
            carrera: carrera ?? 'Todas las carreras',
            // CACEI Criterio 8 requiere: inserción laboral, pertinencia,
            // satisfacción con la formación y vinculación con empleadores.
            secciones: {
                insercionLaboral: {
                    tasaEmpleabilidad: this.calcularPorcentaje(
                        datos.estadisticas.kpis.empleados,
                        datos.estadisticas.kpis.total_egresados,
                    ),
                    situacionLaboral: datos.estadisticas.situacionLaboral,
                    empleabilidadCarrera: datos.estadisticas.empleabilidadCarrera,
                    tiempoEmpleo: datos.estadisticas.tiempoEmpleoGeneral,
                    coincidenciaLaboral: datos.estadisticas.coincidenciaCarrera,
                },
                pertinenciaFormacion: {
                    satisfaccionPromedio: datos.estadisticas.kpis.satisfaccion_promedio,
                    satisfaccionCarrera: datos.estadisticas.satisfaccionCarrera,
                    habilidadesDeficit: [],
                },
                titulacion: {
                    tasaTitulacion: this.calcularPorcentaje(
                        datos.estadisticas.kpis.titulados,
                        datos.estadisticas.kpis.total_egresados,
                    ),
                    titulacionCarrera: datos.estadisticas.titulacionCarrera,
                    titulacionAnio: datos.estadisticas.titulacionAnio,
                },
                vinculacionEmpleadores: {
                    topEmpresas: datos.estadisticas.topEmpresas,
                    autorizados_contacto: datos.estadisticas.kpis.autorizo_contacto,
                    participacionCarrera: datos.estadisticas.participacionCarrera,
                },
                movilidad: {
                    kpisGeo: datos.geografia.kpisGeo,
                    extranjerosPorPais: datos.geografia.extranjerosPorPais,
                    movilidadCarrera: datos.geografia.movilidadPorCarrera,
                },
            },
        };
    }

    // ── REPORTE ABET ────────────────────────────────────────────────────────

    async getDatosABET(anio?: number, carrera?: string) {
        const datos = await this.consolidarDatos(anio, carrera);

        return {
            organismo: 'ABET',
            tipo: 'Student Outcomes & Graduate Tracking Report',
            anio: anio ?? null,
            carrera: carrera ?? 'Todas las carreras',
            // ABET evalúa: student outcomes (competencias al egresar),
            // continuous improvement y datos de empleadores.
            secciones: {
                studentOutcomes: {
                    totalEgresados: datos.estadisticas.kpis.total_egresados,
                    tasaEmpleabilidad: this.calcularPorcentaje(
                        datos.estadisticas.kpis.empleados,
                        datos.estadisticas.kpis.total_egresados,
                    ),
                    coincidenciaLaboral: datos.estadisticas.coincidenciaCarrera,
                    nivelesIngles: datos.estadisticas.nivelesIngles,
                    inglesCarrera: datos.estadisticas.inglesCarrera,
                },
                continuousImprovement: {
                    satisfaccionPromedio: datos.estadisticas.kpis.satisfaccion_promedio,
                    satisfaccionCarrera: datos.estadisticas.satisfaccionCarrera,
                    evolucionGeneracion: datos.estadisticas.evolucionGeneracion,
                    titulacionCarreraAnio: datos.estadisticas.titulacionCarreraAnio,
                },
                employerData: {
                    topEmpresas: datos.estadisticas.topEmpresas,
                    sectorLaboral: datos.estadisticas.sectorLaboral,
                    movilidadInternacional: {
                        total: datos.geografia.kpisGeo.en_extranjero,
                        paises: datos.geografia.extranjerosPorPais,
                        detalle: datos.geografia.extranjerosDetalle,
                    },
                },
                diversidadEquidad: {
                    genero: datos.genero.kpisGenero,
                    empleabilidadGenero: datos.genero.empleabilidadGenero,
                    titulacionGenero: datos.genero.titulacionGenero,
                    inglesGenero: datos.genero.inglesGenero,
                },
            },
        };
    }

    // ── HISTORIAL ───────────────────────────────────────────────────────────

    async registrarEnHistorial(dto: {
        tipo_reporte: string;
        organismo: string;
        carrera?: string;
        anio?: number;
        formato: string;
        generado_por?: string;
    }): Promise<ReporteHistorial> {

        const reporte = new ReporteHistorial();
        reporte.tipo_reporte = dto.tipo_reporte;
        reporte.organismo = dto.organismo;
        reporte.carrera = dto.carrera ?? null;
        reporte.anio = dto.anio ?? null;
        reporte.formato = dto.formato;
        reporte.generado_por = dto.generado_por ?? 'Sistema';

        return this.reportesRepo.save(reporte);
    }

    async getHistorial(): Promise<ReporteHistorial[]> {
        return this.reportesRepo.find({
            order: { fecha_generacion: 'DESC' },
        });
    }

    async eliminarDelHistorial(id: number): Promise<{ mensaje: string }> {
        await this.reportesRepo.delete(id);
        return { mensaje: 'Registro eliminado del historial.' };
    }

    // ── UTILIDADES ──────────────────────────────────────────────────────────

    private calcularPorcentaje(parte: number, total: number): number {
        if (!total || total === 0) return 0;
        return parseFloat(((parte / total) * 100).toFixed(1));
    }
}