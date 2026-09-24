import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const ESTADOS_CANDIDATO = ['pendiente', 'confirmado', 'descartado'] as const;
export type EstadoCandidato = typeof ESTADOS_CANDIDATO[number];

export class ListarDuplicadosDto {

  @IsOptional()
  @IsIn(ESTADOS_CANDIDATO)
  estado?: EstadoCandidato;

  // nombre_carrera, igual que en los demás filtros (?carrera=Sistemas).
  @IsOptional()
  @IsString()
  @MaxLength(150)
  carrera?: string;

  // limit/offset se aplican sobre GRUPOS, no sobre pares: un caso
  // A~B~C nunca queda partido entre dos páginas.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
