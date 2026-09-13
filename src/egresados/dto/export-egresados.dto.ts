import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class ExportEgresadosDto {

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsString()
  carrera?: string;

  @IsOptional()
  @IsNumberString()
  anio?: string;

  @IsOptional()
  @IsString()
  situacion_laboral?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((v) => v.trim()).filter(Boolean)
      : value,
  )
  @IsIn(['Titulado', 'En trámite', 'No titulado'], { each: true })
  estatus_titulacion?: string[];

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  autorizo_contacto?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  autorizo_eventos?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1')
  autorizo_estadisticas?: boolean;
}