import {
  IsString, IsNumber, IsBoolean, IsEmail, IsNotEmpty,
  IsOptional, ValidateNested, ValidateIf, Min, Max
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AutorizacionesDto {
  @IsBoolean() estadisticas: boolean;
  @IsBoolean() contacto: boolean;
  @IsBoolean() eventos: boolean;
}

export class CreateEgresadoEtapa1Dto {
  @IsString() @IsNotEmpty() nombre_completo: string;
  @IsString() @IsNotEmpty() genero: string;
  @IsEmail() correo: string;
  @IsString() @IsNotEmpty() telefono: string;
  @IsString() @IsNotEmpty() ciudad_residencia: string;
  @IsString() @IsNotEmpty() carrera: string;
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
}