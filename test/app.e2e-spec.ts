import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ users_count: 0 }]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('name', 'ConnectEd API');
        expect(res.body).toHaveProperty('status', 'active');
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('docs', '/api/docs');
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('/api/database/clean (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/database/clean')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Database cleaned successfully');
      });
  });

  it('/api/database/clean (DELETE)', () => {
    return request(app.getHttpServer())
      .delete('/api/database/clean')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });
  });
});
