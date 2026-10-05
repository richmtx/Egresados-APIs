import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export const LIMITE_TEXTOS_DEFAULT = 100;
export const LIMITE_TEXTOS_MAX = 500;

export class ListarTextosEmpresaDto {

  // Coincidencia parcial sobre el texto crudo, sin distinguir mayúsculas.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  busqueda?: string;

  // `?limite=` vacío cuenta como no enviado (aplica el default).
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(LIMITE_TEXTOS_MAX)
  limite?: number;
}
