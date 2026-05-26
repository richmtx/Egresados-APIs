import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Importación del módulo de cada una de las APIs
import { EgresadosModule } from './egresados/egresados.module';
import { CarrerasModule } from './carreras/carreras.module';
import { AntiguedadModule } from './antiguedad-empleo/antiguedad.module';
import { AutorizacionesModule } from './autorizaciones/autorizaciones.module';
import { CertificacionesModule } from './certificaciones/certificaciones.module';
import { CertificacionesVModule } from './certificaciones-vigentes/certificacionesV.module';
import { CoincidenciaModule } from './coincidencia-laboral/coincidencia.module';
import { ColabOtroModule } from './colaboracion-otro/colabOtro.module';
import { ColaboracionesModule } from './colaboraciones/colaboraciones.module';
import { EgresadoColabModule } from './egresado-colaboraciones/egresadoColab.module';
import { EgresadoHabModule } from './egresado-habilidades/egresadoHab.module';
import { GenerosModule } from './generos/generos.module';
import { HabilidadesModule } from './habilidades/habilidades.module';
import { HabOtroModule } from './habilidades-otro/habOtro.module';
import { NivelesModule } from './niveles-ingles/niveles.module';
import { FormacionModule } from './satisfaccion-formacion/formacion.module';
import { SituacionModule } from './situacion-laboral/situacion.module';
import { TitulacionModule } from './titulacion/titulacion.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'California29',
      database: process.env.DB_NAME || 'egresados',
      autoLoadEntities: true,
      synchronize: false,
      timezone: 'Z',
    }),

    // Registro de módulos
    EgresadosModule,
    CarrerasModule,
    AntiguedadModule,
    AutorizacionesModule,
    CertificacionesModule,
    CertificacionesVModule,
    CoincidenciaModule,
    ColabOtroModule,
    ColaboracionesModule,
    EgresadoColabModule,
    EgresadoHabModule,
    GenerosModule,
    HabilidadesModule,
    HabOtroModule,
    NivelesModule,
    FormacionModule,
    SituacionModule,
    TitulacionModule,
    AuthModule,
    UsuariosModule,
    NotificacionesModule,
    DashboardModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }