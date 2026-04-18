import { IsString, IsArray, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateEgresadoEtapa2Dto {
  @IsEmail()                 correo:               string;
  @IsString() @IsNotEmpty()  nombre_completo:      string;
  @IsString() @IsNotEmpty()  numero_control:       string;
  @IsString() @IsOptional()  linkedin:             string;
  @IsString() @IsOptional()  puesto_trabajo:       string;
  @IsString() @IsNotEmpty()  coincidencia_laboral: string;
  @IsString() @IsOptional()  certificaciones:      string;
  @IsArray()                 habilidades:          string[];
  @IsString() @IsOptional()  habilidad_otro:       string;
  @IsArray()                 colaboraciones:       string[];
  @IsString() @IsOptional()  colaboracion_otro:    string;
}