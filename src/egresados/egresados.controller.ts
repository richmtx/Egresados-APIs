import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, Delete, UseInterceptors, UploadedFile, BadRequestException, Res, UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { EgresadosService } from './egresados.service';
import { CreateEgresadoEtapa1Dto } from './dto/create-egresado-etapa1.dto';
import { CreateEgresadoEtapa2Dto } from './dto/create-egresado-etapa2.dto';
import { ExportEgresadosDto } from './dto/export-egresados.dto';
import { ExportService } from './export/export.service';
import { ExportEstadisticasService } from './export/export-estadisticas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

const FOTOS_DIR = join(process.cwd(), 'uploads', 'fotos');

const multerFotoOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, FOTOS_DIR),
    filename: (_req, file, cb) => {
      const unico = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${unico}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
    permitidos.includes(file.mimetype)
      ? cb(null, true)
      : cb(new BadRequestException('Solo se permiten imágenes JPG, PNG o WEBP.'), false);
  },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('egresados')
export class EgresadosController {

  constructor(
    private readonly egresadosService: EgresadosService,
    private readonly exportService: ExportService,
    private readonly exportEstadisticasService: ExportEstadisticasService,
  ) { }

  // POST

  @Public()
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

  // PATCH

  @Public()
  @Patch('etapa2/:id')
  completarEtapa2(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEgresadoEtapa2Dto,
  ) {
    return this.egresadosService.completarEtapa2(id, dto);
  }

  @Roles('admin')
  @Patch(':id/revisado')
  marcarRevisado(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { revisado: boolean; revisado_por: string },
  ) {
    return this.egresadosService.marcarRevisado(id, body.revisado, body.revisado_por);
  }

  // GET estáticas

  @Public()
  @Get('buscar')
  buscarPorCorreo(@Query('correo') correo: string) {
    return this.egresadosService.buscarPorCorreo(correo);
  }

  @Get('detalles')
  findAllConDetalles() {
    return this.egresadosService.findAllConDetalles();
  }

  @Get('estadisticas/export/pdf')
  async exportEstadisticasPdf(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarEstadisticasPdf(
      carrera,
      anio ? +anio : undefined,
    );
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="estadisticas_${fecha}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('estadisticas/export/excel')
  async exportEstadisticasExcel(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarEstadisticasExcel(
      carrera,
      anio ? +anio : undefined,
    );
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="estadisticas_${fecha}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('estadisticas/genero/export/pdf')
  async exportGenerosPdf(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarGenerosPdf(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="generos_${fecha}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('estadisticas/genero/export/excel')
  async exportGenerosExcel(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarGenerosExcel(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="generos_${fecha}.xlsx"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('empleabilidad/export/pdf')
  async exportEmpleabilidadPdf(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Query('tiempo') tiempo?: string,
    @Query('medio') medio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarEmpleabilidadPdf(
      carrera, anio ? +anio : undefined, tiempo, medio,
    );
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="empleabilidad_${fecha}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('empleabilidad/export/excel')
  async exportEmpleabilidadExcel(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Query('tiempo') tiempo?: string,
    @Query('medio') medio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarEmpleabilidadExcel(
      carrera, anio ? +anio : undefined, tiempo, medio,
    );
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="empleabilidad_${fecha}.xlsx"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('titulacion/export/pdf')
  async exportTitulacionPdf(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarTitulacionPdf(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="titulacion_${fecha}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('titulacion/export/excel')
  async exportTitulacionExcel(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarTitulacionExcel(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="titulacion_${fecha}.xlsx"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('vinculacion/export/pdf')
  async exportVinculacionPdf(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarVinculacionPdf(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="vinculacion_${fecha}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('vinculacion/export/excel')
  async exportVinculacionExcel(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarVinculacionExcel(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="vinculacion_${fecha}.xlsx"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('vinculacion/panel/export/pdf')
  async exportVinculacionPanelPdf(
    @Query('seccion') seccion: 'colab' | 'hab' | 'auth',
    @Query('valor') valor: string,
    @Query('titulo') titulo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarVinculacionPanelPdf(
      seccion, valor, titulo, carrera, anio ? +anio : undefined,
    );
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vinculacion_panel_${fecha}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('vinculacion/panel/export/excel')
  async exportVinculacionPanelExcel(
    @Query('seccion') seccion: 'colab' | 'hab' | 'auth',
    @Query('valor') valor: string,
    @Query('titulo') titulo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarVinculacionPanelExcel(
      seccion, valor, titulo, carrera, anio ? +anio : undefined,
    );
    const fecha = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="vinculacion_panel_${fecha}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('comparativas/export/pdf')
  async exportComparativasPdf(
    @Query('carreras') carrerasParam: string,
    @Res() res?: any,
  ) {
    const carreras = carrerasParam ? carrerasParam.split(',').map(c => c.trim()).filter(Boolean) : [];
    const buffer = await this.exportEstadisticasService.exportarComparativasPdf(carreras);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="comparativas_${fecha}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('comparativas/export/excel')
  async exportComparativasExcel(
    @Query('carreras') carrerasParam: string,
    @Res() res?: any,
  ) {
    const carreras = carrerasParam ? carrerasParam.split(',').map(c => c.trim()).filter(Boolean) : [];
    const buffer = await this.exportEstadisticasService.exportarComparativasExcel(carreras);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="comparativas_${fecha}.xlsx"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('distribucion-geografica/export/pdf')
  async exportGeografiaPdf(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarGeografiaPdf(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="geografia_${fecha}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('distribucion-geografica/export/excel')
  async exportGeografiaExcel(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Res() res?: any,
  ) {
    const buffer = await this.exportEstadisticasService.exportarGeografiaExcel(carrera, anio ? +anio : undefined);
    const fecha = new Date().toISOString().split('T')[0];
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="geografia_${fecha}.xlsx"`, 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('estadisticas')
  getEstadisticas(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: number,
    @Query('tiempo') tiempo?: string,
    @Query('medio') medio?: string,
  ) {
    return this.egresadosService.getEstadisticas(carrera, anio, tiempo, medio);
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

  @Get('vinculacion/carreras')
  getVinculacionCarreras() {
    return this.egresadosService.getVinculacionCarreras();
  }

  @Get('vinculacion/anios')
  getVinculacionAnios() {
    return this.egresadosService.getVinculacionAnios();
  }

  @Get('comparativas')
  getComparativas(@Query('carreras') carrerasParam: string) {
    const carreras = carrerasParam
      ? carrerasParam.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    return this.egresadosService.getComparativas(carreras);
  }

  @Get('directorio/filtros')
  getFiltrosDirectorio() {
    return this.egresadosService.getFiltrosDirectorio();
  }

  @Get('directorio')
  getDirectorioPublico(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit: number,
    @Query('busqueda') busqueda?: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
    @Query('titulacion') titulacion?: string,
  ) {
    return this.egresadosService.getDirectorioPublico(
      page, limit, busqueda, carrera,
      anio ? parseInt(anio) : undefined,
      titulacion,
    );
  }

  @Roles('admin')
  @Get('pendientes-revision')
  getPendientesRevision() {
    return this.egresadosService.getPendientesRevision();
  }

  @Roles('admin')
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

  @Roles('admin')
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

  @Roles('admin')
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

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.remove(id);
  }
}