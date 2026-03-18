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

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}