import {
  IsString, IsNumber, IsBoolean, IsEmail, IsNotEmpty, IsArray,
  IsOptional, ValidateNested, ValidateIf, Min, Max, IsIn,
  MaxLength, ArrayMaxSize
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { MaxCurrentYear } from '../../common/validators/max-current-year.decorator';

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

// ── Trayectoria profesional (datos NORMALES, sin consentimiento especial) ──
// Los catálogos viajan como CLAVES; el servicio resuelve clave → id.

export class EstudioPosteriorDto {
  // clave de niveles_estudio (especialidad, maestria, doctorado, diplomado)
  @IsString() @IsNotEmpty() @MaxLength(30) nivel: string;

  @IsString() @IsNotEmpty() @MaxLength(150) nombre_programa: string;
  @IsString() @IsNotEmpty() @MaxLength(150) institucion: string;

  // clave de estados_estudio (en_curso, concluido, trunco)
  @IsString() @IsNotEmpty() @MaxLength(30) estado: string;

  @IsOptional() @IsNumber() @Min(1950) @MaxCurrentYear() anio?: number;
}

export class EmprendimientoDto {
  @IsString() @IsNotEmpty() @MaxLength(150) nombre: string;
  @IsString() @IsNotEmpty() @MaxLength(150) giro: string;

  @IsOptional() @IsNumber() @Min(1950) @MaxCurrentYear() anio_inicio?: number;

  @IsOptional() @IsBoolean() sigue_operando?: boolean;

  // clave de rangos_empleados (solo_yo, 2_5, 6_10, mas_10)
  @IsOptional() @IsString() @MaxLength(30) rango_empleados?: string;
}

export class ProyectoSocialDto {
  @IsString() @IsNotEmpty() @MaxLength(150) nombre: string;

  // clave de tipos_proyecto_social (voluntariado, comunitario, ...)
  @IsString() @IsNotEmpty() @MaxLength(30) tipo: string;

  @IsOptional() @IsNumber() @Min(1950) @MaxCurrentYear() anio?: number;

  @IsOptional() @IsString() @MaxLength(150) organizacion?: string;
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
  @MaxCurrentYear()
  anio_ingreso?: number;

  @IsOptional()
  @IsIn(['Enero - Junio', 'Agosto - Diciembre', 'No lo recuerdo'])
  periodo_ingreso?: string;
  
  @IsNumber() @Min(1990) @MaxCurrentYear() anio_egreso: number;
  @IsString() @IsNotEmpty() estatus_titulacion: string;
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

  // Puesto actual (antes se capturaba en la etapa 2)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  puesto_trabajo?: string;

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

  // Empresa y puesto del primer empleo (opcionales; se ignoran si aún no ha
  // conseguido empleo)
  @IsOptional() @IsString() @MaxLength(150) primer_empleo_empresa?: string;
  @IsOptional() @IsString() @MaxLength(150) primer_empleo_puesto?: string;

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

  // ── Trayectoria profesional (opcionales, 1-a-N) ───────────────────────
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EstudioPosteriorDto)
  estudios?: EstudioPosteriorDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EmprendimientoDto)
  emprendimientos?: EmprendimientoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ProyectoSocialDto)
  proyectos_sociales?: ProyectoSocialDto[];
}