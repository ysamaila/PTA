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
  ConversationType,
} from '../src/common/enums/index.js';

describe('Messaging Module (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const parentUserId = '11111111-aaaa-4111-a111-111111111111';
  const teacherUserId = '22222222-bbbb-4222-a222-222222222222';
  const thirdPartyUserId = '33333333-cccc-4333-a333-333333333333';
  const conversationId = 'cccccccc-cccc-4ccc-accc-cccccccccccc';

  let parentToken: string;
  let teacherToken: string;
  let thirdPartyToken: string;

  const mockParentUser = {
    id: parentUserId,
    email: 'parent@school.edu',
    role: Role.PARENT,
    accountStatus: AccountStatus.ACTIVE,
    isEmailVerified: true,
  };

  const mockTeacherUser = {
    id: teacherUserId,
    email: 'teacher@school.edu',
    role: Role.TEACHER,
    accountStatus: AccountStatus.ACTIVE,
    isEmailVerified: true,
  };

  const mockThirdPartyUser = {
    id: thirdPartyUserId,
    email: 'stranger@school.edu',
    role: Role.PARENT,
    accountStatus: AccountStatus.ACTIVE,
    isEmailVerified: true,
  };

  const mockConversation = {
    id: conversationId,
    type: ConversationType.DIRECT,
    title: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: [
      {
        conversationId,
        userId: parentUserId,
        lastReadAt: new Date(),
        user: {
          ...mockParentUser,
          parentProfile: { fullName: 'Parent User', schoolName: 'Afrotech' },
          teacherProfile: null,
          studentProfile: null,
        },
      },
      {
        conversationId,
        userId: teacherUserId,
        lastReadAt: null,
        user: {
          ...mockTeacherUser,
          parentProfile: null,
          teacherProfile: {
            fullName: 'Miss Edith Robinson',
            schoolName: 'Afrotech',
          },
          studentProfile: null,
        },
      },
    ],
    messages: [
      {
        id: 'msg-1',
        conversationId,
        senderId: parentUserId,
        body: 'Hello teacher, I have a question.',
        isDelivered: true,
        createdAt: new Date(),
      },
    ],
  };

  const mockPrisma: any = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === parentUserId) return Promise.resolve(mockParentUser);
        if (where.id === teacherUserId) return Promise.resolve(mockTeacherUser);
        if (where.id === thirdPartyUserId)
          return Promise.resolve(mockThirdPartyUser);
        return Promise.resolve(null);
      }),
    },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(mockConversation),
      findUnique: jest.fn(({ where }: any) => {
        if (where.id === conversationId)
          return Promise.resolve(mockConversation);
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue(mockConversation),
      update: jest.fn().mockResolvedValue(mockConversation),
    },
    conversationParticipant: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: parentUserId,
          conversationId,
          lastReadAt: new Date(),
          conversation: mockConversation,
        },
      ]),
      findUnique: jest.fn(({ where }: any) => {
        const key = where.conversationId_userId;
        if (
          key &&
          key.conversationId === conversationId &&
          (key.userId === parentUserId || key.userId === teacherUserId)
        ) {
          return Promise.resolve({
            conversationId,
            userId: key.userId,
            lastReadAt: new Date(),
          });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({
        conversationId,
        userId: parentUserId,
        lastReadAt: new Date(),
      }),
    },
    message: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'msg-new',
          ...data,
          isDelivered: true,
          createdAt: new Date(),
        }),
      ),
      count: jest.fn().mockResolvedValue(1),
    },
    $transaction: jest.fn((promises: any[]) => Promise.all(promises)),
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

    parentToken = await jwtService.signAsync({
      sub: parentUserId,
      email: 'parent@school.edu',
      role: Role.PARENT,
      accountStatus: AccountStatus.ACTIVE,
    });

    teacherToken = await jwtService.signAsync({
      sub: teacherUserId,
      email: 'teacher@school.edu',
      role: Role.TEACHER,
      accountStatus: AccountStatus.ACTIVE,
    });

    thirdPartyToken = await jwtService.signAsync({
      sub: thirdPartyUserId,
      email: 'stranger@school.edu',
      role: Role.PARENT,
      accountStatus: AccountStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authorization & Security', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(app.getHttpServer()).get('/api/conversations').expect(401);
    });

    it('rejects user viewing conversation they are not participant in with 403', async () => {
      await request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .expect(403);
    });

    it('rejects user sending message to conversation they are not participant in with 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .send({ body: 'Intruder message' })
        .expect(403);
    });
  });

  describe('Conversation & Messaging Lifecycle', () => {
    it('POST /api/conversations - starts or retrieves direct conversation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/conversations')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          recipientUserId: teacherUserId,
          initialMessage: 'Good morning Miss Edith',
        })
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.id).toBe(conversationId);
    });

    it('GET /api/conversations - lists user conversations with unread counts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/conversations')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('unreadCount');
      expect(res.body[0]).toHaveProperty('recipient');
    });

    it('GET /api/conversations/:id - gets messages and marks conversation read', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.id).toBe(conversationId);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it('POST /api/conversations/:id/messages - sends a new message in the conversation', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          body: 'Thank you for reaching out Mrs. Chukwunonso.',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.body).toBe(
        'Thank you for reaching out Mrs. Chukwunonso.',
      );
    });

    it('GET /api/conversations/unread-count - gets unread count across all conversations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/conversations/unread-count')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('unreadCount');
      expect(typeof res.body.unreadCount).toBe('number');
    });

    it('PATCH /api/conversations/:id/read - explicitly marks conversation read', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.message).toBe('Conversation marked as read');
    });
  });
});
