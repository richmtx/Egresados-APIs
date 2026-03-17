import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { EgresadosModule } from './egresados/egresados.module';
import { CarrerasModule } from './carreras/carreras.module';

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

    // Registro de módulos del proyecto
    EgresadosModule,
    CarrerasModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}