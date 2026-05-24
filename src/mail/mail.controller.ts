import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { MailService } from './mail.service';
import { EnviarCorreoDto } from './dto/enviar-correo.dto';

@Controller('correo')
export class MailController {
    constructor(private readonly mailService: MailService) { }

    @Post('enviar')
    @HttpCode(200)
    async enviar(@Body() dto: EnviarCorreoDto) {
        await this.mailService.enviarMasivo(dto);
        return {
            ok: true,
            enviados: dto.destinatarios.length,
            mensaje: `Correo enviado a ${dto.destinatarios.length} destinatario(s)`,
        };
    }
}