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
}
