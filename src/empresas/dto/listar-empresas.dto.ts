import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListarEmpresasDto {

  // LIKE sobre el nombre canónico.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  busqueda?: string;
}
