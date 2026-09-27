import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { getCorsConfig } from '../src/main.js';

describe('CORS Configuration (e2e)', () => {
  let app: INestApplication;
  const productionFrontend = 'https://pta-website-six.vercel.app';

  const mockPrisma: any = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  };

  const mockMail = {
    sendVerificationCode: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(MailService)
      .useValue(mockMail)
      .compile();

    app = moduleFixture.createNestApplication();

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

    const configService = app.get(ConfigService);
    const corsConfig = getCorsConfig(configService);
    app.enableCors(corsConfig);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Preflight (OPTIONS) requests', () => {
    it('returns expected CORS headers for OPTIONS /api/auth/parent/register from production frontend', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/auth/parent/register')
        .set('Origin', productionFrontend)
        .set('Access-Control-Request-Method', 'POST')
        .set(
          'Access-Control-Request-Headers',
          'Content-Type, Authorization, Accept',
        );

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        productionFrontend,
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST',
      );
      expect(response.headers['access-control-allow-methods']).toContain(
        'OPTIONS',
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'Content-Type',
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'Authorization',
      );
    });

    it('does not return Access-Control-Allow-Origin for unauthorized origin on OPTIONS /api/auth/parent/register', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/auth/parent/register')
        .set('Origin', 'https://unauthorized-malicious-site.example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Actual (POST) requests', () => {
    it('returns Access-Control-Allow-Origin and credentials headers for POST /api/auth/parent/register from production frontend', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/parent/register')
        .set('Origin', productionFrontend)
        .send({
          // Empty payload will trigger validation error, but CORS headers must be present
        });

      expect(response.headers['access-control-allow-origin']).toBe(
        productionFrontend,
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('getCorsConfig environment awareness', () => {
    it('excludes localhost origins by default in production environment', () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'APP_ENV') return 'production';
          if (key === 'CORS_ORIGIN') return '';
          return defaultValue;
        }),
      } as unknown as ConfigService;

      const config = getCorsConfig(mockConfigService);
      const origins = config.origin as string[];

      expect(origins).toContain(productionFrontend);
      expect(origins).not.toContain('http://localhost:3000');
      expect(origins).not.toContain('http://localhost:5173');
      expect(config.credentials).toBe(true);
      expect(config.origin).not.toBe('*');
    });

    it('includes localhost origins in development environment', () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'APP_ENV') return 'development';
          if (key === 'CORS_ORIGIN') return '';
          return defaultValue;
        }),
      } as unknown as ConfigService;

      const config = getCorsConfig(mockConfigService);
      const origins = config.origin as string[];

      expect(origins).toContain(productionFrontend);
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://localhost:5173');
      expect(config.credentials).toBe(true);
      expect(config.origin).not.toBe('*');
    });

    it('cleans trailing slashes from custom origins in CORS_ORIGIN', () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'APP_ENV') return 'production';
          if (key === 'CORS_ORIGIN')
            return 'https://custom-portal.org/, https://school.edu/ ';
          return defaultValue;
        }),
      } as unknown as ConfigService;

      const config = getCorsConfig(mockConfigService);
      const origins = config.origin as string[];

      expect(origins).toContain('https://custom-portal.org');
      expect(origins).toContain('https://school.edu');
      expect(origins).not.toContain('https://custom-portal.org/');
    });
  });
});
