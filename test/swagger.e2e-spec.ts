import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MailService } from '../src/mail/mail.service.js';

describe('Swagger Documentation (Check)', () => {
  let app: INestApplication;
  let document: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(MailService)
      .useValue({ sendVerificationCode: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();

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
      })
      .build();

    document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate a valid OpenAPI 3.0 specification document', () => {
    expect(document).toBeDefined();
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('PTA Authentication API');
    expect(document.components.securitySchemes.bearer).toBeDefined();
  });

  it('should include all required authentication endpoints in Swagger document', () => {
    const paths = Object.keys(document.paths);
    expect(paths).toContain('/api/auth/parent/register');
    expect(paths).toContain('/api/auth/teacher/register');
    expect(paths).toContain('/api/auth/parent/login');
    expect(paths).toContain('/api/auth/teacher/login');
    expect(paths).toContain('/api/auth/verify-code');
    expect(paths).toContain('/api/auth/resend-code');
    expect(paths).toContain('/api/auth/refresh');
    expect(paths).toContain('/api/auth/logout');
    expect(paths).toContain('/api/auth/me');
  });

  it('should serve Swagger UI at /api/docs', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Swagger UI');
  });
});
