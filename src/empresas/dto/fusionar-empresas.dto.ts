import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString, MaxLength,
} from 'class-validator';

export class FusionarEmpresasDto {

  // Nombre que queda en el catálogo. Misma longitud que empresas.nombre.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nombre_canonico: string;

  // Textos crudos TAL COMO están en egresados (con sus mayúsculas, acentos y
  // espacios): se comparan de forma exacta. NO se valida que compartan
  // nombre_clave; la fusión manual existe justo para los casos que ninguna
  // regla de texto agrupa (CFE / Comisión Federal de Electricidad).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(255, { each: true })
  variantes: string[];
}
