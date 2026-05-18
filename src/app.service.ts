import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Sistema Backend de APIs para la plataforma de Seguimiento de Egresados del ITD';
  }
}
