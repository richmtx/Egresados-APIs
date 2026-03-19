import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'California29',
      database: 'egresados',
      autoLoadEntities: true,
      synchronize: false,
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
    UsuariosModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}