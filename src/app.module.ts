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
import { DiscapacidadDominiosModule } from './discapacidad-dominios/discapacidad-dominios.module';
import { GradosDificultadModule } from './grados-dificultad/grados-dificultad.module';
import { RespuestasAutoadscripcionModule } from './respuestas-autoadscripcion/respuestas-autoadscripcion.module';
import { InclusionModule } from './inclusion/inclusion.module';
import { NivelesEstudioModule } from './niveles-estudio/niveles-estudio.module';
import { EstadosEstudioModule } from './estados-estudio/estados-estudio.module';
import { TiposProyectoSocialModule } from './tipos-proyecto-social/tipos-proyecto-social.module';
import { RangosEmpleadosModule } from './rangos-empleados/rangos-empleados.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
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
    DiscapacidadDominiosModule,
    GradosDificultadModule,
    RespuestasAutoadscripcionModule,
    NivelesEstudioModule,
    EstadosEstudioModule,
    TiposProyectoSocialModule,
    RangosEmpleadosModule,
    AuthModule,
    UsuariosModule,
    NotificacionesModule,
    DashboardModule,
    MailModule,
    InclusionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }