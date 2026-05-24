import { IsArray, IsEmail, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator';

export class EnviarCorreoDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsEmail({}, { each: true })
    destinatarios: string[];

    @IsString()
    @IsNotEmpty()
    asunto: string;

    @IsString()
    @IsNotEmpty()
    mensaje: string;
}