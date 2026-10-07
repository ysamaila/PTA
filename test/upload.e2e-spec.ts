import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { Role, AccountStatus } from '../src/common/enums/index.js';

describe('UploadController (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  const mockTestUser = {
    id: 'test-uploader-id-12345',
    email: 'uploader@pta-school.org',
    role: Role.TEACHER,
    accountStatus: AccountStatus.ACTIVE,
    isEmailVerified: true,
  };

  const mockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (
          where?.id === mockTestUser.id ||
          where?.email === mockTestUser.email
        ) {
          return Promise.resolve(mockTestUser);
        }
        return Promise.resolve(null);
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
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

    const jwtService = app.get(JwtService);
    jwtToken = await jwtService.signAsync({
      sub: mockTestUser.id,
      email: mockTestUser.email,
      role: mockTestUser.role,
      accountStatus: mockTestUser.accountStatus,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Security & Authentication Gates', () => {
    it('should reject unauthenticated upload with 401 Unauthorized', () => {
      return request(app.getHttpServer())
        .post('/api/upload')
        .attach('file', Buffer.from('dummy data'), 'test.pdf')
        .expect(401);
    });

    it('should reject upload when no file is attached with 400 Bad Request', () => {
      return request(app.getHttpServer())
        .post('/api/upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('A file must be provided');
        });
    });

    it('should reject unsupported file extensions/mimetypes (.exe) with 400 Bad Request', () => {
      return request(app.getHttpServer())
        .post('/api/upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', Buffer.from('binary-exe-content'), {
          filename: 'malicious.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Unsupported file type');
        });
    });
  });

  describe('Cloudinary Single and Multiple Uploads', () => {
    it('should upload a single document/image to Cloudinary and return secure URL', async () => {
      const validPdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
206
%%EOF`);

      const response = await request(app.getHttpServer())
        .post('/api/upload')
        .set('Authorization', `Bearer ${jwtToken}`)
        .field('folder', 'pta/e2e-tests')
        .attach('file', validPdf, {
          filename: 'sample-worksheet.pdf',
          contentType: 'application/pdf',
        })
        .expect(200);

      expect(response.body).toHaveProperty('secureUrl');
      expect(response.body.secureUrl).toContain('res.cloudinary.com');
      expect(response.body.secureUrl).toContain('dexcjehcfive');
      expect(response.body).toHaveProperty('publicId');
      expect(response.body.publicId).toContain('pta/e2e-tests');
      expect(response.body.originalFilename).toBe('sample-worksheet.pdf');
      expect(response.body.bytes).toBeGreaterThan(0);
    }, 25000);

    it('should upload multiple documents/images in batch to Cloudinary', async () => {
      const file1 = Buffer.from('Attachment one test');
      const file2 = Buffer.from('Attachment two test');

      const response = await request(app.getHttpServer())
        .post('/api/upload/multiple')
        .set('Authorization', `Bearer ${jwtToken}`)
        .field('folder', 'pta/e2e-tests')
        .attach('files', file1, {
          filename: 'doc-1.txt',
          contentType: 'text/plain',
        })
        .attach('files', file2, {
          filename: 'doc-2.txt',
          contentType: 'text/plain',
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].secureUrl).toContain('res.cloudinary.com');
      expect(response.body[1].secureUrl).toContain('res.cloudinary.com');
      expect(response.body[0].originalFilename).toBe('doc-1.txt');
      expect(response.body[1].originalFilename).toBe('doc-2.txt');
    }, 30000);
  });
});
