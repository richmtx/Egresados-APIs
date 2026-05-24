import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EnviarCorreoDto } from './dto/enviar-correo.dto';

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService) { }

    async enviarMasivo(dto: EnviarCorreoDto): Promise<void> {
        try {
            await this.mailerService.sendMail({
                // BCC para no exponer correos entre egresados
                bcc: dto.destinatarios,
                subject: dto.asunto,
                text: dto.mensaje,
                // Si en el futuro quieres HTML:
                // html: `<p>${dto.mensaje.replace(/\n/g, '<br>')}</p>`,
            });
        } catch (error) {
            console.error('Error al enviar correo:', error);
            throw new InternalServerErrorException('No se pudo enviar el correo');
        }
    }
}