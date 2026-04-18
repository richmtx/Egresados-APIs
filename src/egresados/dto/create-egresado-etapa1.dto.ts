import { IsString, IsNumber, IsBoolean, IsEmail, IsNotEmpty, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AutorizacionesDto {
  @IsBoolean() estadisticas: boolean;
  @IsBoolean() contacto:     boolean;
  @IsBoolean() eventos:      boolean;
}

export class CreateEgresadoEtapa1Dto {
  @IsString()  @IsNotEmpty() nombre_completo:    string;
  @IsString()  @IsNotEmpty() genero:             string;
  @IsEmail()                 correo:             string;
  @IsString()  @IsNotEmpty() telefono:           string;
  @IsString()  @IsNotEmpty() ciudad_residencia:  string;
  @IsString()  @IsNotEmpty() carrera:            string;
  @IsNumber()  @Min(1990) @Max(2026) anio_egreso: number;
  @IsString()  @IsNotEmpty() estatus_titulacion:    string;
  @IsString()  @IsNotEmpty() certificacion_vigente: string;
  @IsString()  @IsNotEmpty() nivel_ingles:          string;
  @IsString()  @IsNotEmpty() situacion_laboral:     string;
  @IsString()                empresa:               string;
  @IsString()  @IsNotEmpty() antiguedad_empleo:     string;
  @IsString()                ciudad_trabajo:        string;
  @IsNumber()  @Min(1) @Max(5) satisfaccion_formacion: number;

  @ValidateNested()
  @Type(() => AutorizacionesDto)
  autorizaciones: AutorizacionesDto;
}