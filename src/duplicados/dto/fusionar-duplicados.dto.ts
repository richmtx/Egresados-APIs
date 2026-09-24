import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';

export class FusionarDuplicadosDto {

  // El registro que sobrevive.
  @IsInt()
  @Min(1)
  id_egresado_conservado: number;

  // Uno o más registros que se fusionan en el conservado y después se BORRAN.
  // Un caso puede tener 3 o más personas: se fusiona el grupo completo en
  // una sola transacción. Repetidos y el conservado se validan en el servicio
  // para devolver un mensaje claro.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids_eliminados: number[];

  // Por qué se conservó ese y no el otro. Misma longitud que la columna notas.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
