import { Body, Controller, Post, HttpCode, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { MailService } from './mail.service';
import { EnviarCorreoDto } from './dto/enviar-correo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('correo')
export class MailController {
    constructor(private readonly mailService: MailService) { }

    // Endpoint principal
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 2, ttl: 60000 } })
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

    // ── Endpoint de prueba (sin JWT para testing rápido) ────────────
    // ⚠️ IMPORTANTE: elimina este endpoint antes de subir a producción
    @Post('test')
    @HttpCode(200)
    async testEmail() {
        await this.mailService.enviarMasivo({
            destinatarios: ['tu-correo@gmail.com'], // 👈 cambia esto
            asunto: '✅ Prueba de correo — NestJS SMTP',
            esHtml: true,
            mensaje: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #4CAF50;">¡Correo de prueba exitoso!</h2>
                    <p>Si recibes esto, tu configuración SMTP con Gmail funciona correctamente.</p>
                    <hr/>
                    <small style="color: #999;">Enviado desde NestJS + @nestjs-modules/mailer</small>
                </div>
            `,
        });

        return {
            ok: true,
            mensaje: 'Correo de prueba enviado. Revisa tu bandeja de entrada.',
        };
    }
}