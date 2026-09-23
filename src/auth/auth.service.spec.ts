import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { Role, AccountStatus } from '../common/enums/index.js';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    verificationCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) =>
      callback(mockPrismaService),
    ),
  };

  const mockTokenService = {
    hashToken: jest.fn((val: string) => `hashed_${val}`),
    generateTokens: jest.fn().mockResolvedValue({
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      expiresIn: '15m',
      tokenType: 'Bearer',
    }),
    rotateRefreshToken: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
  };

  const mockMailService = {
    sendVerificationCode: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('registerParent', () => {
    it('should successfully register a parent and dispatch a 6-digit code', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockImplementation(({ data }: any) => ({
        id: 'user_123',
        email: data.email,
        role: data.role,
        accountStatus: data.accountStatus,
        isEmailVerified: data.isEmailVerified,
        emailVerifiedAt: null,
        createdAt: new Date(),
        parentProfile: {
          fullName: 'Parent One',
          phone: '1234567890',
        },
      }));

      const result = await service.registerParent({
        email: 'parent@example.com',
        password: 'Password123!',
        fullName: 'Parent One',
        phone: '1234567890',
      });

      expect(result.user.role).toBe(Role.PARENT);
      expect(result.user.accountStatus).toBe(
        AccountStatus.PENDING_VERIFICATION,
      );
      expect(mockMailService.sendVerificationCode).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should reject registration if email is already in use', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing_id',
      });

      await expect(
        service.registerParent({
          email: 'duplicate@example.com',
          password: 'Password123!',
          fullName: 'Duplicate User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('registerTeacher', () => {
    it('should successfully register a teacher with TEACHER role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockImplementation(({ data }: any) => ({
        id: 'teacher_123',
        email: data.email,
        role: data.role,
        accountStatus: data.accountStatus,
        isEmailVerified: data.isEmailVerified,
        emailVerifiedAt: null,
        createdAt: new Date(),
        teacherProfile: {
          fullName: 'Teacher Jane',
          subjectSpecialization: 'Physics',
        },
      }));

      const result = await service.registerTeacher({
        email: 'teacher@example.com',
        password: 'Password123!',
        fullName: 'Teacher Jane',
        subjectSpecialization: 'Physics',
      });

      expect(result.user.role).toBe(Role.TEACHER);
      expect(result.user.accountStatus).toBe(
        AccountStatus.PENDING_VERIFICATION,
      );
      expect(mockMailService.sendVerificationCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyEmailCode', () => {
    it('should activate parent account upon valid 6-digit code', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'parent@example.com',
        role: Role.PARENT,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        isEmailVerified: false,
        parentProfile: { fullName: 'Parent One' },
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.verificationCode.findFirst.mockResolvedValue({
        id: 'code_1',
        userId: 'user_123',
        codeHash: 'hashed_123456',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 0,
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
        accountStatus: AccountStatus.ACTIVE,
      });

      const res = await service.verifyEmailCode({
        email: 'parent@example.com',
        code: '123456',
      });

      expect(res.user.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(mockPrismaService.verificationCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'code_1' } }),
      );
    });

    it('should reject expired verification code', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'parent@example.com',
        isEmailVerified: false,
      });
      mockPrismaService.verificationCode.findFirst.mockResolvedValue({
        id: 'code_1',
        expiresAt: new Date(Date.now() - 10000),
        attempts: 0,
      });

      await expect(
        service.verifyEmailCode({
          email: 'parent@example.com',
          code: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment attempts and reject invalid code', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'parent@example.com',
        isEmailVerified: false,
      });
      mockPrismaService.verificationCode.findFirst.mockResolvedValue({
        id: 'code_1',
        codeHash: 'hashed_999999',
        expiresAt: new Date(Date.now() + 600000),
        attempts: 0,
      });

      await expect(
        service.verifyEmailCode({
          email: 'parent@example.com',
          code: '000000',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.verificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code_1' },
        data: { attempts: { increment: 1 } },
      });
    });
  });

  describe('loginParent and loginTeacher', () => {
    it('should log in parent with valid credentials', async () => {
      const hash = await argon2.hash('Secret123');
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'parent@example.com',
        passwordHash: hash,
        role: Role.PARENT,
        accountStatus: AccountStatus.ACTIVE,
        isEmailVerified: true,
        parentProfile: { fullName: 'Parent One' },
      });

      const result = await service.loginParent({
        email: 'parent@example.com',
        password: 'Secret123',
      });

      expect(result.tokens.accessToken).toBe('mock_access_token');
      expect(result.user.email).toBe('parent@example.com');
    });

    it('should reject login if parent attempts to login via teacher endpoint', async () => {
      const hash = await argon2.hash('Secret123');
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'parent@example.com',
        passwordHash: hash,
        role: Role.PARENT,
        accountStatus: AccountStatus.ACTIVE,
      });

      await expect(
        service.loginTeacher({
          email: 'parent@example.com',
          password: 'Secret123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login if email is not verified', async () => {
      const hash = await argon2.hash('Secret123');
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'parent@example.com',
        passwordHash: hash,
        role: Role.PARENT,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
        isEmailVerified: false,
      });

      await expect(
        service.loginParent({
          email: 'parent@example.com',
          password: 'Secret123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject login if teacher account is pending approval', async () => {
      const hash = await argon2.hash('Secret123');
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user_2',
        email: 'teacher@example.com',
        passwordHash: hash,
        role: Role.TEACHER,
        accountStatus: AccountStatus.PENDING_APPROVAL,
        isEmailVerified: true,
      });

      await expect(
        service.loginTeacher({
          email: 'teacher@example.com',
          password: 'Secret123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject suspended accounts', async () => {
      const hash = await argon2.hash('Secret123');
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user_1',
        email: 'parent@example.com',
        passwordHash: hash,
        role: Role.PARENT,
        accountStatus: AccountStatus.SUSPENDED,
      });

      await expect(
        service.loginParent({
          email: 'parent@example.com',
          password: 'Secret123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
