import {
    IsArray, IsEmail, IsNotEmpty, IsString,
    ArrayMinSize, IsOptional, IsBoolean, ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdjuntoDto {
    @IsString()
    @IsNotEmpty()
    filename: string;      // Nombre del archivo: "reporte.pdf"

    @IsString()
    @IsNotEmpty()
    content: string;       // Base64 del archivo

    @IsString()
    @IsOptional()
    contentType?: string;  // "application/pdf", "image/png", etc.
}

export class EnviarCorreoDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsEmail({}, { each: true })
    destinatarios: string[];

    @IsArray()
    @IsEmail({}, { each: true })
    @IsOptional()
    cc?: string[];         // Con copia

    @IsArray()
    @IsEmail({}, { each: true })
    @IsOptional()
    bcc?: string[];        // Con copia oculta

    @IsString()
    @IsNotEmpty()
    asunto: string;

    @IsString()
    @IsNotEmpty()
    mensaje: string;       // Texto plano o HTML según esHtml

    @IsBoolean()
    @IsOptional()
    esHtml?: boolean;      // true = mensaje se envía como HTML

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdjuntoDto)
    @IsOptional()
    adjuntos?: AdjuntoDto[];
}