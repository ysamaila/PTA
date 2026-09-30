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
  BehaviorCategory,
} from '../src/common/enums/index.js';

describe('Pastoral Care & Behavior Tracking Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const teacherUserId = '11111111-1111-4111-a111-111111111111';
  const otherTeacherUserId = '99999999-9999-4999-a999-999999999999';
  const studentUserId = '22222222-2222-4222-a222-222222222222';
  const otherStudentUserId = '88888888-8888-4888-a888-888888888888';
  const parentUserId = '33333333-3333-4333-a333-333333333333';
  const otherParentUserId = '44444444-4444-4444-a444-444444444444';
  const adminUserId = '55555555-5555-4555-a555-555555555555';

  const teacherId = 'cccccccc-cccc-4ccc-accc-cccccccccccc';
  const otherTeacherId = 'dddddddd-dddd-4ddd-addd-dddddddddddd';
  const studentId = '66666666-6666-4666-a666-666666666666';
  const otherStudentId = '77777777-7777-4777-a777-777777777777';
  const sessionId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const behaviorRecordId = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';

  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let parentToken: string;
  let otherParentToken: string;
  let adminToken: string;

  const mockTeacher = {
    id: teacherId,
    userId: teacherUserId,
    fullName: 'Mr. Emmanuel Adeyemi',
    schoolName: 'Afrotech Academy',
    assignedGrade: 'Grade 5',
    roomNumber: 'Room 201',
  };

  const mockOtherTeacher = {
    id: otherTeacherId,
    userId: otherTeacherUserId,
    fullName: 'Mrs. Funke Akindele',
    schoolName: 'Afrotech Academy',
    assignedGrade: 'Grade 1',
    roomNumber: 'Room 101',
  };

  const mockStudent = {
    id: studentId,
    userId: studentUserId,
    studentCode: '06201',
    firstName: 'Divine',
    lastName: 'Ekubor',
    grade: 'Grade 5',
    room: 'Room 201',
    primaryTeacherId: teacherId,
  };

  const mockOtherStudent = {
    id: otherStudentId,
    userId: otherStudentUserId,
    studentCode: '06202',
    firstName: 'Tems',
    lastName: 'Openiyi',
    grade: 'Grade 1',
    room: 'Room 101',
    primaryTeacherId: otherTeacherId,
  };

  const mockSession = {
    id: sessionId,
    sessionYear: '2026/2027',
    termName: 'First Term',
    isCurrent: true,
  };

  const mockBehaviorRecord = {
    id: behaviorRecordId,
    studentId,
    teacherId,
    academicSessionId: sessionId,
    category: BehaviorCategory.TEAMWORK,
    score: 92,
    remarks: 'Outstanding collaboration during group science tasks.',
    evaluationDate: new Date('2026-09-29'),
    createdAt: new Date(),
    updatedAt: new Date(),
    student: mockStudent,
    teacher: mockTeacher,
    academicSession: mockSession,
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
        if (where.id === otherTeacherUserId) {
          return Promise.resolve({
            id: otherTeacherUserId,
            email: 'otherteacher@school.edu',
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
        if (where.id === otherStudentUserId) {
          return Promise.resolve({
            id: otherStudentUserId,
            email: 'otherstudent@school.edu',
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
            email: 'otherparent@school.edu',
            role: Role.PARENT,
            accountStatus: AccountStatus.ACTIVE,
            isEmailVerified: true,
          });
        }
        if (where.id === adminUserId) {
          return Promise.resolve({
            id: adminUserId,
            email: 'admin@school.edu',
            role: Role.ADMIN,
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
        if (where.userId === otherTeacherUserId || where.id === otherTeacherId) {
          return Promise.resolve(mockOtherTeacher);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockResolvedValue(mockTeacher),
    },
    student: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.userId === studentUserId || where.id === studentId) {
          return Promise.resolve(mockStudent);
        }
        if (where.userId === otherStudentUserId || where.id === otherStudentId) {
          return Promise.resolve(mockOtherStudent);
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockStudent]),
    },
    academicSession: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === sessionId) {
          return Promise.resolve(mockSession);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockResolvedValue(mockSession),
    },
    behaviorRecord: {
      upsert: jest.fn().mockResolvedValue(mockBehaviorRecord),
      findMany: jest.fn().mockResolvedValue([mockBehaviorRecord]),
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === behaviorRecordId) {
          return Promise.resolve(mockBehaviorRecord);
        }
        return Promise.resolve(null);
      }),
      update: jest.fn(({ data }: any) =>
        Promise.resolve({
          ...mockBehaviorRecord,
          ...data,
        }),
      ),
      delete: jest.fn().mockResolvedValue(mockBehaviorRecord),
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

    otherTeacherToken = await jwtService.signAsync({
      sub: otherTeacherUserId,
      email: 'otherteacher@school.edu',
      role: Role.TEACHER,
      accountStatus: AccountStatus.ACTIVE,
    });

    studentToken = await jwtService.signAsync({
      sub: studentUserId,
      email: 'student@school.edu',
      role: Role.STUDENT,
      accountStatus: AccountStatus.ACTIVE,
    });

    otherStudentToken = await jwtService.signAsync({
      sub: otherStudentUserId,
      email: 'otherstudent@school.edu',
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
      email: 'otherparent@school.edu',
      role: Role.PARENT,
      accountStatus: AccountStatus.ACTIVE,
    });

    adminToken = await jwtService.signAsync({
      sub: adminUserId,
      email: 'admin@school.edu',
      role: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/behavior', () => {
    it('allows teacher to record behavior evaluation for an assigned student', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/behavior')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          academicSessionId: sessionId,
          category: BehaviorCategory.TEAMWORK,
          score: 92,
          remarks: 'Outstanding collaboration during group science tasks.',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Behavior evaluation recorded successfully');
      expect(response.body.rating).toBe('EXCELLENT');
      expect(response.body.record.score).toBe(92);
    });

    it('rejects evaluation when teacher tries to evaluate student not in assigned class', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/behavior')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: otherStudentId,
          academicSessionId: sessionId,
          category: BehaviorCategory.TEAMWORK,
          score: 80,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not enrolled in your assigned classroom roster');
    });

    it('rejects evaluation if user is a student or parent', async () => {
      const studentRes = await request(app.getHttpServer())
        .post('/api/behavior')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId,
          academicSessionId: sessionId,
          category: BehaviorCategory.TEAMWORK,
          score: 90,
        });

      expect(studentRes.status).toBe(403);

      const parentRes = await request(app.getHttpServer())
        .post('/api/behavior')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId,
          academicSessionId: sessionId,
          category: BehaviorCategory.TEAMWORK,
          score: 90,
        });

      expect(parentRes.status).toBe(403);
    });

    it('rejects evaluation with score > 100', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/behavior')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          academicSessionId: sessionId,
          category: BehaviorCategory.TEAMWORK,
          score: 110,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/behavior/student/:studentId', () => {
    it('allows student to view their own behavior report', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/behavior/student/${studentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.student.id).toBe(studentId);
      expect(response.body.overallAverageScore).toBe(92);
      expect(response.body.overallRating).toBe('EXCELLENT');
    });

    it('rejects student attempting to view another student behavior report', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/behavior/student/${studentId}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Students can only view their own behavior records');
    });

    it('allows linked parent to view child behavior report', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/behavior/student/${studentId}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.student.id).toBe(studentId);
    });

    it('rejects unlinked parent from viewing student behavior report', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/behavior/student/${studentId}`)
        .set('Authorization', `Bearer ${otherParentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('permission to view behavior records');
    });

    it('allows homeroom teacher to view student behavior report', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/behavior/student/${studentId}/session/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.student.id).toBe(studentId);
    });

    it('allows Admin to view any student behavior report', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/behavior/student/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.student.id).toBe(studentId);
    });
  });

  describe('GET /api/behavior/classroom', () => {
    it('returns classroom behavior matrix for teacher', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/behavior/classroom')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.classSummary).toBeDefined();
      expect(response.body.students).toBeInstanceOf(Array);
      expect(response.body.students).toHaveLength(1);
    });

    it('rejects student from viewing classroom behavior matrix', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/behavior/classroom')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/behavior/:id', () => {
    it('allows creator teacher to update behavior record', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/behavior/${behaviorRecordId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          score: 95,
          remarks: 'Updated remarks for exemplary effort.',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Behavior record updated successfully');
      expect(response.body.record.score).toBe(95);
    });

    it('rejects update by another teacher who did not create the record', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/behavior/${behaviorRecordId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .send({
          score: 70,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/behavior/:id', () => {
    it('rejects delete by non-creator teacher', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/behavior/${behaviorRecordId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`);

      expect(response.status).toBe(403);
    });

    it('allows creator teacher to delete behavior record', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/behavior/${behaviorRecordId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Behavior record deleted successfully');
    });
  });
});
