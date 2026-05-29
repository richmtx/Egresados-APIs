import { IsOptional, IsString, IsNumber, IsObject } from 'class-validator';

export class ChartImages {
  @IsOptional() @IsString() situacionLaboral?: string;
  @IsOptional() @IsString() empleabilidadCarrera?: string;
  @IsOptional() @IsString() estadoTitulacion?: string;
  @IsOptional() @IsString() tendenciaTitulacion?: string;
  @IsOptional() @IsString() nivelesIngles?: string;
  @IsOptional() @IsString() inglesCarrera?: string;
  @IsOptional() @IsString() satisfaccionCarrera?: string;
  @IsOptional() @IsString() topEmpresas?: string;
  @IsOptional() @IsString() autorizacionesCarrera?: string;
  @IsOptional() @IsString() fueraDurango?: string;
  @IsOptional() @IsString() fueraMexico?: string;
}

export class ExportEstadisticasDto {
  @IsOptional() @IsString()  carrera?: string;
  @IsOptional() @IsNumber()  anio?: number;
  @IsOptional() @IsObject()  chartImages?: ChartImages;
}