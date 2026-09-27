import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { AppModule } from './app.module.js';

export function getCorsConfig(configService: ConfigService): CorsOptions {
  const appEnv =
    configService.get<string>('APP_ENV') ||
    configService.get<string>('NODE_ENV') ||
    'development';
  const isProduction = appEnv.toLowerCase() === 'production';

  // Explicit production frontend origins that must always be permitted
  const productionOrigins = ['https://pta-website-six.vercel.app'];

  // Local development origins
  const developmentOrigins = ['http://localhost:3000', 'http://localhost:5173'];

  // Configured origins from environment variable (comma-separated)
  const envCorsOrigin = configService.get<string>('CORS_ORIGIN', '');
  const customOrigins = envCorsOrigin
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set([
      ...productionOrigins,
      ...(isProduction ? [] : developmentOrigins),
      ...customOrigins,
    ]),
  );

  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const corsConfig = getCorsConfig(configService);
  app.enableCors(corsConfig);
  const originList = Array.isArray(corsConfig.origin)
    ? corsConfig.origin.map(String).join(', ')
    : String(corsConfig.origin ?? '');
  logger.log(`Allowed CORS origins: ${originList}`);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PTA Authentication API')
    .setDescription(
      'Authentication Module with Role-Based Access Control and Brevo OTP Verification',
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter your JWT access token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`PTA Backend running on port ${port}`);
  logger.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
