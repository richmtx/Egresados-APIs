import {
  IsString, IsNumber, IsBoolean, IsEmail, IsNotEmpty, IsArray,
  IsOptional, ValidateNested, ValidateIf, Min, Max, IsIn,
  MaxLength, ArrayMaxSize
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AutorizacionesDto {
  @IsBoolean() estadisticas: boolean;
  @IsBoolean() contacto: boolean;
  @IsBoolean() eventos: boolean;
}

// ── Datos de inclusión (datos personales SENSIBLES, LFPDPPP) ─────────────
// Todos viajan como CLAVES de catálogo; el servicio resuelve clave → id.

export class DiscapacidadRespuestaDto {
  // clave de discapacidad_dominios (ver, oir, caminar, ...)
  @IsString() @IsNotEmpty() @MaxLength(20) dominio: string;

  // clave de grados_dificultad (sin_dificultad, mucha_dificultad, ...)
  @IsString() @IsNotEmpty() @MaxLength(20) grado: string;
}

export class IdentidadDto {
  // claves de respuestas_autoadscripcion (si, no, no_declara)
  @IsString() @IsNotEmpty() @MaxLength(20) indigena: string;
  @IsString() @IsNotEmpty() @MaxLength(20) habla_lengua: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lengua_indigena?: string;

  @IsString() @IsNotEmpty() @MaxLength(20) afromexicano: string;
}

export class CreateEgresadoEtapa1Dto {
  @IsString() @IsNotEmpty() nombre_completo: string;
  @IsString() @IsNotEmpty() genero: string;
  @IsEmail() correo: string;
  @IsString() @IsNotEmpty() telefono: string;
  @IsString() @IsNotEmpty() ciudad_residencia: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pais_nacimiento?: string;

  @IsString() @IsNotEmpty() carrera: string;

  @IsOptional()
  @IsNumber()
  @Min(1980)
  @Max(2026)
  anio_ingreso?: number;

  @IsOptional()
  @IsIn(['Enero - Junio', 'Agosto - Diciembre', 'No lo recuerdo'])
  periodo_ingreso?: string;
  
  @IsNumber() @Min(1990) @Max(2026) anio_egreso: number;
  @IsString() @IsNotEmpty() estatus_titulacion: string;
  @IsString() @IsNotEmpty() certificacion_vigente: string;
  @IsString() @IsNotEmpty() nivel_ingles: string;
  @IsString() @IsNotEmpty() situacion_laboral: string;

  // Campos laborales opcionales
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ?? '')
  empresa?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ?? '')
  antiguedad_empleo?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ?? '')
  ciudad_trabajo?: string;

  // ── primer empleo ─────────────────────────────────────────────────────
  @IsString() @IsNotEmpty() tiempo_primer_empleo: string;

  // Obligatorio solo si SÍ consiguió empleo
  @ValidateIf((o) => o.tiempo_primer_empleo !== 'Aún no he conseguido empleo')
  @IsString()
  @IsNotEmpty()
  medio_primer_empleo?: string;

  // Obligatorio solo si consiguió empleo Y eligió "Otra"
  @ValidateIf((o) =>
    o.tiempo_primer_empleo !== 'Aún no he conseguido empleo' &&
    o.medio_primer_empleo === 'Otra',
  )
  @IsString()
  @IsNotEmpty({ message: 'Especifica el medio cuando seleccionas "Otra".' })
  @Transform(({ value }) => value ?? '')
  medio_primer_empleo_otro?: string;

  // ── NUEVO: redes sociales (opcionales) ────────────────────────────────
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ?? '')
  facebook?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ?? '')
  instagram?: string;
  // ──────────────────────────────────────────────────────────────────────

  @IsNumber() @Min(1) @Max(5) satisfaccion_formacion: number;

  @ValidateNested()
  @Type(() => AutorizacionesDto)
  autorizaciones: AutorizacionesDto;

  // ── Datos sensibles de inclusión (opcionales) ─────────────────────────
  @IsOptional()
  @IsBoolean()
  consintio_datos_sensibles?: boolean;

  // Máx. 6 = un elemento por dominio de discapacidad_dominios
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => DiscapacidadRespuestaDto)
  discapacidad?: DiscapacidadRespuestaDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => IdentidadDto)
  identidad?: IdentidadDto;
}