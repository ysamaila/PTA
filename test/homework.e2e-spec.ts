import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { MailService } from '../src/mail/mail.service.js';
import {
  Role,
  AccountStatus,
  HomeworkStatus,
  SubmissionStatus,
} from '../src/common/enums/index.js';

describe('Homework Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const teacherUserId = '11111111-1111-4111-a111-111111111111';
  const studentUserId = '22222222-2222-4222-a222-222222222222';
  const parentUserId = '33333333-3333-4333-a333-333333333333';
  const otherParentUserId = '44444444-4444-4444-a444-444444444444';

  const teacherId = 'teacher-profile-uuid';
  const studentId = '55555555-5555-4555-a555-555555555555';
  const subjectId = '66666666-6666-4666-a666-666666666666';
  const homeworkId = '77777777-7777-4777-a777-777777777777';

  let teacherToken: string;
  let studentToken: string;
  let parentToken: string;
  let otherParentToken: string;

  const mockTeacher = {
    id: teacherId,
    userId: teacherUserId,
    fullName: 'Miss Edith Robinson',
    schoolName: 'Afrotech Academy',
  };

  const mockStudent = {
    id: studentId,
    userId: studentUserId,
    studentCode: '06201',
    firstName: 'Divine',
    lastName: 'Ekubor',
    grade: 'Grade 5',
    room: 'Room 201',
  };

  const mockSubject = {
    id: subjectId,
    name: 'Mathematics',
    code: 'MATH',
  };

  const mockHomework = {
    id: homeworkId,
    teacherId,
    subjectId,
    gradeLevel: 'Grade 5',
    room: 'Room 201',
    title: 'Fractions Practice',
    instructions: 'Complete page 42.',
    dueDate: new Date('2026-10-10'),
    status: HomeworkStatus.PUBLISHED,
    attachmentUrls: ['https://example.com/sheet.pdf'],
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: mockSubject,
    teacher: mockTeacher,
    submissions: [],
  };

  const mockSubmission = {
    id: 'submission-uuid-1',
    homeworkId,
    studentId,
    status: SubmissionStatus.SUBMITTED,
    completedAt: new Date(),
    submissionNotes: 'All questions done',
    attachmentUrls: [],
    parentSignatureVerified: false,
    parentSignedAt: null,
    parentSignedByUserId: null,
  };

  const mockPrisma: any = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === teacherUserId) {
          return Promise.resolve({
            id: teacherUserId,
            email: 'teacher@school.edu',
            role: Role.TEACHER,
            accountStatus: AccountStatus.ACTIVE,
            isEmailVerified: true,
          });
        }
        if (where.id === studentUserId) {
          return Promise.resolve({
            id: studentUserId,
            email: 'student@school.edu',
            role: Role.STUDENT,
            accountStatus: AccountStatus.ACTIVE,
            isEmailVerified: true,
          });
        }
        if (where.id === parentUserId) {
          return Promise.resolve({
            id: parentUserId,
            email: 'parent@school.edu',
            role: Role.PARENT,
            accountStatus: AccountStatus.ACTIVE,
            isEmailVerified: true,
          });
        }
        if (where.id === otherParentUserId) {
          return Promise.resolve({
            id: otherParentUserId,
            email: 'other@school.edu',
            role: Role.PARENT,
            accountStatus: AccountStatus.ACTIVE,
            isEmailVerified: true,
          });
        }
        return Promise.resolve(null);
      }),
    },
    teacherProfile: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.userId === teacherUserId || where.id === teacherId) {
          return Promise.resolve(mockTeacher);
        }
        return Promise.resolve(null);
      }),
    },
    student: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.userId === studentUserId || where.id === studentId) {
          return Promise.resolve(mockStudent);
        }
        return Promise.resolve(null);
      }),
    },
    subject: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === subjectId) {
          return Promise.resolve(mockSubject);
        }
        return Promise.resolve(null);
      }),
    },
    homework: {
      create: jest.fn().mockResolvedValue(mockHomework),
      findMany: jest.fn().mockResolvedValue([mockHomework]),
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === homeworkId) {
          return Promise.resolve({
            ...mockHomework,
            submissions: [
              {
                ...mockSubmission,
                student: mockStudent,
              },
            ],
          });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({
        ...mockHomework,
        title: 'Updated Fractions',
      }),
      delete: jest.fn().mockResolvedValue(mockHomework),
    },
    homeworkSubmission: {
      upsert: jest.fn().mockResolvedValue(mockSubmission),
      findUnique: jest.fn(({ where }: any) => {
        const key = where.homeworkId_studentId;
        if (
          key &&
          key.homeworkId === homeworkId &&
          key.studentId === studentId
        ) {
          return Promise.resolve(mockSubmission);
        }
        return Promise.resolve(null);
      }),
      update: jest.fn(({ data }: any) =>
        Promise.resolve({
          ...mockSubmission,
          ...data,
        }),
      ),
    },
    studentParentLink: {
      findUnique: jest.fn(({ where }: any) => {
        const key = where.studentId_parentUserId;
        if (
          key &&
          key.studentId === studentId &&
          key.parentUserId === parentUserId
        ) {
          return Promise.resolve({
            id: 'link-1',
            studentId,
            parentUserId,
            student: mockStudent,
          });
        }
        return Promise.resolve(null);
      }),
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
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    teacherToken = await jwtService.signAsync({
      sub: teacherUserId,
      email: 'teacher@school.edu',
      role: Role.TEACHER,
      accountStatus: AccountStatus.ACTIVE,
    });

    studentToken = await jwtService.signAsync({
      sub: studentUserId,
      email: 'student@school.edu',
      role: Role.STUDENT,
      accountStatus: AccountStatus.ACTIVE,
    });

    parentToken = await jwtService.signAsync({
      sub: parentUserId,
      email: 'parent@school.edu',
      role: Role.PARENT,
      accountStatus: AccountStatus.ACTIVE,
    });

    otherParentToken = await jwtService.signAsync({
      sub: otherParentUserId,
      email: 'other@school.edu',
      role: Role.PARENT,
      accountStatus: AccountStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authorization checks', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(app.getHttpServer()).get('/api/homework').expect(401);
    });

    it('rejects student attempting to create homework with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/homework')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          subjectId,
          gradeLevel: 'Grade 5',
          title: 'Unauthorized Task',
          instructions: 'None',
          dueDate: '2026-10-10',
        })
        .expect(403);
    });

    it('rejects parent attempting to delete homework with 403', async () => {
      await request(app.getHttpServer())
        .delete(`/api/homework/${homeworkId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(403);
    });
  });

  describe('Teacher workflow', () => {
    it('POST /api/homework - teacher creates homework assignment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/homework')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          subjectId,
          gradeLevel: 'Grade 5',
          room: 'Room 201',
          title: 'Fractions Practice',
          instructions: 'Complete page 42.',
          dueDate: '2026-10-10',
          attachmentUrls: ['https://example.com/sheet.pdf'],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Fractions Practice');
    });

    it('GET /api/homework - teacher lists their homework', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/homework')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/homework/:id - retrieves homework details with stats', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/homework/${homeworkId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.id).toBe(homeworkId);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('totalSubmissions');
      expect(res.body.stats).toHaveProperty('submittedCount');
    });

    it('PATCH /api/homework/:id - teacher updates homework', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/homework/${homeworkId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Updated Fractions' })
        .expect(200);

      expect(res.body.title).toBe('Updated Fractions');
    });

    it('DELETE /api/homework/:id - teacher deletes homework', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/homework/${homeworkId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.message).toContain('deleted successfully');
    });
  });

  describe('Student workflow', () => {
    it('GET /api/homework/student/my-homework - student views assigned homework', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/homework/student/my-homework')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('submission');
    });

    it('POST /api/homework/:id/submit - student submits homework', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/homework/${homeworkId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          submissionNotes: 'All questions done',
        })
        .expect(200);

      expect(res.body.status).toBe(SubmissionStatus.SUBMITTED);
    });
  });

  describe('Parent verification workflow', () => {
    it('GET /api/homework/parent/student/:studentId - linked parent views homework', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/homework/parent/student/${studentId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/homework/parent/student/:studentId - unlinked parent is rejected with 403', async () => {
      await request(app.getHttpServer())
        .get(`/api/homework/parent/student/${studentId}`)
        .set('Authorization', `Bearer ${otherParentToken}`)
        .expect(403);
    });

    it('PATCH /api/homework/:id/parent-sign/:studentId - linked parent signs homework', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/homework/${homeworkId}/parent-sign/${studentId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.parentSignatureVerified).toBe(true);
    });
  });

  describe('Teacher review workflow', () => {
    it('PATCH /api/homework/:id/submissions/:studentId/review - teacher marks submission reviewed', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/homework/${homeworkId}/submissions/${studentId}/review`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ status: SubmissionStatus.REVIEWED })
        .expect(200);

      expect(res.body.status).toBe(SubmissionStatus.REVIEWED);
    });
  });
});
