import { IsOptional, IsString, IsNumber } from 'class-validator';

export class ExportEstadisticasDto {
  @IsOptional() @IsString() carrera?: string;
  @IsOptional() @IsNumber() anio?: number;
}