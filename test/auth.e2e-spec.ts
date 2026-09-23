import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { Role, AccountStatus } from '../src/common/enums/index.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  const mockUsers = new Map<string, any>();
  const mockCodes: any[] = [];

  const mockPrisma: any = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.email) {
          return Promise.resolve(mockUsers.get(where.email) || null);
        }
        if (where.id) {
          for (const u of mockUsers.values()) {
            if (u.id === where.id) return Promise.resolve(u);
          }
        }
        return Promise.resolve(null);
      }),
      create: jest.fn(({ data }: any) => {
        const id = `user_${Date.now()}`;
        const user = {
          id,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role,
          accountStatus: data.accountStatus,
          isEmailVerified: data.isEmailVerified ?? false,
          emailVerifiedAt: null,
          createdAt: new Date(),
          parentProfile: data.parentProfile?.create || null,
          teacherProfile: data.teacherProfile?.create || null,
        };
        mockUsers.set(data.email, user);
        return Promise.resolve(user);
      }),
      update: jest.fn(({ where, data }: any) => {
        for (const [email, u] of mockUsers.entries()) {
          if (u.id === where.id) {
            const updated = { ...u, ...data };
            mockUsers.set(email, updated);
            return Promise.resolve(updated);
          }
        }
        return Promise.resolve(null);
      }),
    },
    verificationCode: {
      create: jest.fn(({ data }: any) => {
        const record = {
          id: `code_${Date.now()}`,
          ...data,
          attempts: 0,
          usedAt: null,
        };
        mockCodes.push(record);
        return Promise.resolve(record);
      }),
      findFirst: jest.fn(({ where }: any) => {
        const found = mockCodes
          .filter(
            (c) =>
              c.userId === where.userId &&
              c.type === where.type &&
              c.usedAt === null,
          )
          .sort((a, b) => b.id.localeCompare(a.id))[0];
        return Promise.resolve(found || null);
      }),
      update: jest.fn(({ where, data }: any) => {
        const code = mockCodes.find((c) => c.id === where.id);
        if (code) {
          if (data.attempts?.increment) code.attempts += 1;
          if (data.usedAt) code.usedAt = data.usedAt;
          return Promise.resolve(code);
        }
        return Promise.resolve(null);
      }),
      updateMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(({ data }: any) =>
        Promise.resolve({ id: `rt_${Date.now()}`, ...data }),
      ),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
  };

  const mockMail = {
    sendVerificationCode: jest.fn().mockResolvedValue(true),
    sendPasswordResetCode: jest.fn().mockResolvedValue(true),
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
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Parent registration & login flow', () => {
    it('POST /api/auth/parent/register - fails validation on weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/parent/register')
        .send({
          email: 'invalid@example.com',
          password: 'short',
          confirmPassword: 'short',
          fullName: 'Test Parent',
          schoolName: 'Greenwood High',
          studentCode: 'STU-001',
          termsAccepted: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Password must be at least 8 characters long',
          ),
        ]),
      );
    });

    it('POST /api/auth/parent/register - fails when terms are not accepted', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/parent/register')
        .send({
          email: 'terms@example.com',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!',
          fullName: 'Test Parent',
          schoolName: 'Greenwood High',
          studentCode: 'STU-001',
          termsAccepted: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Terms and conditions must be accepted'),
        ]),
      );
    });

    it('POST /api/auth/parent/register - successfully registers parent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/parent/register')
        .send({
          role: 'parent',
          fullName: 'Sarah Connor',
          email: 'validparent@example.com',
          schoolName: 'West High School',
          studentCode: 'STU-12345',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe(Role.PARENT);
      expect(res.body.user.accountStatus).toBe(
        AccountStatus.PENDING_VERIFICATION,
      );
      expect(mockMail.sendVerificationCode).toHaveBeenCalled();
    });

    it('POST /api/auth/parent/login - rejects login when email is unverified', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/parent/login')
        .send({
          email: 'validparent@example.com',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('verify your email');
    });
  });

  describe('Teacher registration flow', () => {
    it('POST /api/auth/teacher/register - registers teacher with TEACHER role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/teacher/register')
        .send({
          role: 'teacher',
          fullName: 'Professor Charles',
          workEmail: 'validteacher@example.com',
          schoolName: 'Xavier Academy',
          password: 'TeacherPassword123!',
          confirmPassword: 'TeacherPassword123!',
          termsAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe(Role.TEACHER);
      expect(res.body.user.accountStatus).toBe(
        AccountStatus.PENDING_VERIFICATION,
      );
    });
  });

  describe('Shared Auth endpoints', () => {
    it('GET /api/auth/me - rejects unauthenticated requests with 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('POST /api/auth/verify-code - validates 6-digit code format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-code')
        .send({
          email: 'validparent@example.com',
          code: '12',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Verification code must be exactly 6 digits'),
        ]),
      );
    });

    it('POST /api/auth/forgot-password - validates email and returns anti-enumeration response', async () => {
      const invalidRes = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(invalidRes.status).toBe(400);

      const validRes = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'validparent@example.com' });

      expect(validRes.status).toBe(200);
      expect(validRes.body.message).toContain(
        'If an account with that email exists',
      );
    });

    it('POST /api/auth/reset-password - validates payload format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          email: 'validparent@example.com',
          code: '12',
          newPassword: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Verification code must be exactly 6 digits'),
          expect.stringContaining(
            'Password must be at least 8 characters long',
          ),
        ]),
      );
    });

    it('POST /api/auth/change-password - rejects unauthenticated requests with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(401);
    });
  });
});
