import { IsIn, IsOptional } from 'class-validator';

export const ESTADOS_CANDIDATO_EMPRESA = ['pendiente', 'fusionado', 'descartado'] as const;
export type EstadoCandidatoEmpresa = typeof ESTADOS_CANDIDATO_EMPRESA[number];

export class ListarCandidatosEmpresaDto {

  @IsOptional()
  @IsIn(ESTADOS_CANDIDATO_EMPRESA)
  estado?: EstadoCandidatoEmpresa;
}
