import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EnviarCorreoDto } from './dto/enviar-correo.dto';

@Injectable()
export class MailService {
    // Logger de NestJS para tener trazas limpias en consola
    private readonly logger = new Logger(MailService.name);

    constructor(private readonly mailerService: MailerService) { }

    async enviarMasivo(dto: EnviarCorreoDto): Promise<void> {
        try {
            const attachments = dto.adjuntos?.map(adj => ({
                filename: adj.filename,
                content: Buffer.from(adj.content, 'base64'),
                contentType: adj.contentType ?? 'application/octet-stream',
            })) ?? [];

            // Pie de página institucional
            const pieDePagina = `
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 11px; color: #999; font-family: Arial, sans-serif;">
                Este correo fue enviado por el Departamento de Gestión Tecnológica 
                y Vinculación del Instituto Tecnológico de Durango.<br>
                Si no esperabas este mensaje, puedes ignorarlo.
            </p>
        `;

            // Si es HTML, convierte saltos de línea y agrega el pie
            // Si es texto plano, lo convierte a HTML también para incluir el pie
            const htmlFinal = dto.esHtml
                ? `${dto.mensaje}${pieDePagina}`
                : `<p>${dto.mensaje.replace(/\n/g, '<br>')}</p>${pieDePagina}`;

            await this.mailerService.sendMail({
                to: dto.destinatarios,
                cc: dto.cc ?? [],
                bcc: dto.bcc ?? [],
                subject: dto.asunto,
                html: htmlFinal,   // ← siempre HTML ahora, el pie lo requiere
                attachments,
            });

            this.logger.log(
                `Correo enviado — Para: ${dto.destinatarios.length} | ` +
                `CC: ${dto.cc?.length ?? 0} | BCC: ${dto.bcc?.length ?? 0}`
            );

        } catch (error) {
            this.logger.error('Error al enviar correo', error?.message);
            throw new InternalServerErrorException('No se pudo enviar el correo');
        }
    }
}