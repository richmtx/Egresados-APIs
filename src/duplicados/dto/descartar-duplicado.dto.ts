import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DescartarDuplicadoDto {

  // Por qué son personas distintas. Misma longitud que la columna notas.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
