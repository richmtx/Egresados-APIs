import { Controller, Get, Post, Delete, Param, Query, ParseIntPipe, Body } from '@nestjs/common';
import { ReportesService } from './reportes.service';

@Controller('reportes')
export class ReportesController {

    constructor(private readonly reportesService: ReportesService) { }

    // ── DATOS PARA VISTA PREVIA / GENERACIÓN ────────────────────────────────

    @Get('tecnm')
    getDatosTecNM(
        @Query('anio') anio?: string,
        @Query('carrera') carrera?: string,
    ) {
        return this.reportesService.getDatosTecNM(
            anio ? +anio : undefined,
            carrera ? carrera : undefined,
        );
    }

    @Get('cacei')
    getDatosCACEI(
        @Query('anio') anio?: string,
        @Query('carrera') carrera?: string,
    ) {
        return this.reportesService.getDatosCACEI(
            anio ? +anio : undefined,
            carrera ? carrera : undefined,
        );
    }

    @Get('abet')
    getDatosABET(
        @Query('anio') anio?: string,
        @Query('carrera') carrera?: string,
    ) {
        return this.reportesService.getDatosABET(
            anio ? +anio : undefined,
            carrera ? carrera : undefined,
        );
    }

    // ── HISTORIAL ───────────────────────────────────────────────────────────

    @Get('historial')
    getHistorial() {
        return this.reportesService.getHistorial();
    }

    @Post('historial')
    registrar(@Body() dto: {
        tipo_reporte: string;
        organismo: string;
        carrera?: string;
        anio?: number;
        formato: string;
        generado_por?: string;
    }) {
        return this.reportesService.registrarEnHistorial(dto);
    }

    @Delete('historial/:id')
    eliminar(@Param('id', ParseIntPipe) id: number) {
        return this.reportesService.eliminarDelHistorial(id);
    }
}