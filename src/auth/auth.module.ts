import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { MailModule } from '../mail/mail.module.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>(
          'JWT_EXPIRES_IN',
          '15m',
        ) as unknown as SignOptions['expiresIn'];
        return {
          secret: configService.get<string>(
            'JWT_SECRET',
            'pta-dev-jwt-access-secret-minimum-32-chars-long',
          ),
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy, RolesGuard],
  exports: [
    AuthService,
    TokenService,
    JwtStrategy,
    RolesGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
