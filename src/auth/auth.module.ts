import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
