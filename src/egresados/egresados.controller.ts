import { Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, Delete, UseInterceptors, UploadedFile, BadRequestException, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EgresadosService } from './egresados.service';
import { CreateEgresadoEtapa1Dto } from './dto/create-egresado-etapa1.dto';
import { CreateEgresadoEtapa2Dto } from './dto/create-egresado-etapa2.dto';
import { ExportEgresadosDto } from './dto/export-egresados.dto';
import { ExportService } from './export/export.service';

const FOTOS_DIR = join(process.cwd(), 'uploads', 'fotos');

if (!existsSync(FOTOS_DIR)) {
  mkdirSync(FOTOS_DIR, { recursive: true });
}

const multerFotoOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, FOTOS_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Solo se permiten imágenes JPG, PNG o WEBP.'), false);
    }
  },
};

@Controller('egresados')
export class EgresadosController {

  constructor(
    private readonly egresadosService: EgresadosService,
    private readonly exportService: ExportService,
  ) { }

  // POST
  @Post('etapa1')
  @UseInterceptors(FileInterceptor('foto', multerFotoOptions))
  async crearEtapa1(
    @UploadedFile() foto: Express.Multer.File | undefined,
    @Body('data') dataRaw: string | undefined,
    @Body() bodyDirecto: any,
  ) {
    let dto: CreateEgresadoEtapa1Dto;

    if (dataRaw) {
      let parsed: any;
      try {
        parsed = JSON.parse(dataRaw);
      } catch {
        throw new BadRequestException('El campo "data" no es un JSON válido.');
      }
      dto = plainToInstance(CreateEgresadoEtapa1Dto, parsed);
      const errores = await validate(dto);
      if (errores.length > 0) throw new BadRequestException(errores);
    } else {
      dto = plainToInstance(CreateEgresadoEtapa1Dto, bodyDirecto);
      const errores = await validate(dto);
      if (errores.length > 0) throw new BadRequestException(errores);
    }

    const fotoUrl = foto ? `uploads/fotos/${foto.filename}` : null;
    return this.egresadosService.crearEtapa1(dto, fotoUrl);
  }

  //  PATCH
  @Patch('etapa2/:id')
  completarEtapa2(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEgresadoEtapa2Dto,
  ) {
    return this.egresadosService.completarEtapa2(id, dto);
  }

  @Patch(':id/revisado')
  marcarRevisado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { revisado: boolean; revisado_por: string },
  ) {
    return this.egresadosService.marcarRevisado(id, body.revisado, body.revisado_por);
  }

  // GET estáticas (sin parámetro dinámico)
  // ⚠️  Todas estas deben ir ANTES de cualquier @Get(':id...')
  @Get('buscar')
  buscarPorCorreo(@Query('correo') correo: string) {
    return this.egresadosService.buscarPorCorreo(correo);
  }

  @Get('detalles')
  findAllConDetalles() {
    return this.egresadosService.findAllConDetalles();
  }

  @Get('estadisticas')
  getEstadisticas(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEstadisticas(carrera, anio ? parseInt(anio) : undefined);
  }

  @Get('estadisticas/genero')
  getEstadisticasGenero(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEstadisticasGenero(carrera, anio ? +anio : undefined);
  }

  @Get('distribucion-geografica')
  getDistribucionGeografica(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getDistribucionGeografica(carrera, anio ? Number(anio) : undefined);
  }

  @Get('vinculacion/colaboracion')
  getEgresadosPorColaboracion(
    @Query('tipo') tipo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorColaboracion(tipo, carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/habilidad')
  getEgresadosPorHabilidad(
    @Query('tipo') tipo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorHabilidad(tipo, carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/totales-colaboraciones')
  getTotalesColaboraciones(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getTotalesColaboraciones(carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/totales-habilidades')
  getTotalesHabilidades(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getTotalesHabilidades(carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/colaboracion-otro')
  getEgresadosColaboracionOtro(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosColaboracionOtro(carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/habilidad-otro')
  getEgresadosHabilidadOtro(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosHabilidadOtro(carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/distribucion-satisfaccion')
  getDistribucionSatisfaccion(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getDistribucionSatisfaccion(carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/autorizacion')
  getEgresadosPorAutorizacion(
    @Query('tipo') tipo: 'estadisticas' | 'contacto' | 'eventos',
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorAutorizacion(tipo, carrera, anio ? +anio : undefined);
  }

  @Get('comparativas')
  getComparativas(@Query('carreras') carrerasParam: string) {
    const carreras = carrerasParam
      ? carrerasParam.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    return this.egresadosService.getComparativas(carreras);
  }

  @Get('directorio')
  getDirectorioPublico(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getDirectorioPublico(carrera, anio ? parseInt(anio) : undefined);
  }

  @Get('pendientes-revision')
  getPendientesRevision() {
    return this.egresadosService.getPendientesRevision();
  }

  @Get('export/pdf')
  async exportPdf(
    @Query() filtros: ExportEgresadosDto,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportarPdf(filtros);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="egresados_${fecha}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('export/excel')
  async exportExcel(
    @Query() filtros: ExportEgresadosDto,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportarExcel(filtros);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="egresados_${fecha}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // GET dinámicas (con :id)
  @Get()
  findAll() {
    return this.egresadosService.findAll();
  }

  @Get(':id/perfil')
  getPerfil(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.getPerfil(id);
  }

  @Get(':id/export/pdf')
  async exportPerfilPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportarPerfilPdf(id);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="perfil_egresado_${id}_${fecha}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.remove(id);
  }
}