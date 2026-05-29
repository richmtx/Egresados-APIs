import { IsArray, IsEmail, IsNotEmpty, IsString, ArrayMinSize, 
    IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjuntoDto {
    @IsString()
    @IsNotEmpty()
    filename: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsOptional()
    contentType?: string;
}

export class EnviarCorreoDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsEmail({}, { each: true })
    destinatarios: string[];

    @IsArray()
    @IsEmail({}, { each: true })
    @IsOptional()
    cc?: string[];      

    @IsArray()
    @IsEmail({}, { each: true })
    @IsOptional()
    bcc?: string[];     

    @IsString()
    @IsNotEmpty()
    asunto: string;

    @IsString()
    @IsNotEmpty()
    mensaje: string;   

    @IsBoolean()
    @IsOptional()
    esHtml?: boolean;    

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdjuntoDto)
    @IsOptional()
    adjuntos?: AdjuntoDto[];
}