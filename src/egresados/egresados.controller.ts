import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, Delete, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EgresadosService } from './egresados.service';
import { CreateEgresadoEtapa1Dto } from './dto/create-egresado-etapa1.dto';
import { CreateEgresadoEtapa2Dto } from './dto/create-egresado-etapa2.dto';

// ── Carpeta destino de las fotos ─────────────────────────────────────────────
const FOTOS_DIR = join(process.cwd(), 'uploads', 'fotos');

// Crea la carpeta si no existe al arrancar
if (!existsSync(FOTOS_DIR)) {
  mkdirSync(FOTOS_DIR, { recursive: true });
}

// Configuración de Multer
const multerFotoOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, FOTOS_DIR),
    filename: (_req, file, cb) => {
      // Nombre: timestamp-random + extensión original
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
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

  constructor(private readonly egresadosService: EgresadosService) { }

  // ── POST /egresados/etapa1 ────────────────────────────────────────────────
  // Acepta tanto JSON puro como multipart/form-data (cuando hay foto).
  // En multipart: campo "data" = JSON del DTO, campo "foto" = archivo.
  @Post('etapa1')
  @UseInterceptors(FileInterceptor('foto', multerFotoOptions))
  async crearEtapa1(
    @UploadedFile() foto: Express.Multer.File | undefined,
    @Body('data') dataRaw: string | undefined,
    @Body() bodyDirecto: any,
  ) {
    let dto: CreateEgresadoEtapa1Dto;

    if (dataRaw) {
      // Viene como multipart/form-data → parsear el campo "data"
      let parsed: any;
      try {
        parsed = JSON.parse(dataRaw);
      } catch {
        throw new BadRequestException('El campo "data" no es un JSON válido.');
      }

      dto = plainToInstance(CreateEgresadoEtapa1Dto, parsed);
      const errores = await validate(dto);
      if (errores.length > 0) {
        throw new BadRequestException(errores);
      }
    } else {
      // Viene como application/json normal (sin foto)
      dto = plainToInstance(CreateEgresadoEtapa1Dto, bodyDirecto);
      const errores = await validate(dto);
      if (errores.length > 0) {
        throw new BadRequestException(errores);
      }
    }

    // Ruta relativa para guardar en BD (o null si no hay foto)
    const fotoUrl = foto
      ? `uploads/fotos/${foto.filename}`
      : null;

    return this.egresadosService.crearEtapa1(dto, fotoUrl);
  }

  // ── PATCH /egresados/etapa2/:id ───────────────────────────────────────────
  @Patch('etapa2/:id')
  completarEtapa2(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEgresadoEtapa2Dto,
  ) {
    return this.egresadosService.completarEtapa2(id, dto);
  }

  // ── GET /egresados/buscar ─────────────────────────────────────────────────
  @Get('buscar')
  buscarPorCorreo(@Query('correo') correo: string) {
    return this.egresadosService.buscarPorCorreo(correo);
  }

  @Get()
  findAll() {
    return this.egresadosService.findAll();
  }

  @Get('detalles')
  findAllConDetalles() {
    return this.egresadosService.findAllConDetalles();
  }

  @Get(':id/perfil')
  getPerfil(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.getPerfil(id);
  }

  @Get('estadisticas')
  getEstadisticas(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEstadisticas(
      carrera,
      anio ? parseInt(anio) : undefined,
    );
  }

  @Get('distribucion-geografica')
  getDistribucionGeografica(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getDistribucionGeografica(
      carrera,
      anio ? Number(anio) : undefined,
    );
  }

  @Get('vinculacion/colaboracion')
  getEgresadosPorColaboracion(
    @Query('tipo') tipo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorColaboracion(
      tipo,
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/habilidad')
  getEgresadosPorHabilidad(
    @Query('tipo') tipo: string,
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorHabilidad(
      tipo,
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/totales-colaboraciones')
  getTotalesColaboraciones(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getTotalesColaboraciones(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/totales-habilidades')
  getTotalesHabilidades(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getTotalesHabilidades(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/colaboracion-otro')
  getEgresadosColaboracionOtro(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosColaboracionOtro(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/habilidad-otro')
  getEgresadosHabilidadOtro(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosHabilidadOtro(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('vinculacion/distribucion-satisfaccion')
  getDistribucionSatisfaccion(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getDistribucionSatisfaccion(
      carrera,
      anio ? +anio : undefined,
    );
  }

  @Get('estadisticas/genero')
  getEstadisticasGenero(
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: number,
  ) {
    return this.egresadosService.getEstadisticasGenero(carrera, anio ? +anio : undefined);
  }

  @Get('vinculacion/autorizacion')
  getEgresadosPorAutorizacion(
    @Query('tipo') tipo: 'estadisticas' | 'contacto' | 'eventos',
    @Query('carrera') carrera?: string,
    @Query('anio') anio?: string,
  ) {
    return this.egresadosService.getEgresadosPorAutorizacion(
      tipo,
      carrera,
      anio ? +anio : undefined,
    );
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
    return this.egresadosService.getDirectorioPublico(
      carrera,
      anio ? parseInt(anio) : undefined,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.egresadosService.remove(id);
  }
}