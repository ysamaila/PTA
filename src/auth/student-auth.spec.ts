import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../mail/mail.service.js';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService - Student Login', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let tokenService: TokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            student: { findUnique: jest.fn() },
            user: { findUnique: jest.fn() },
            refreshToken: { create: jest.fn() },
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokens: jest.fn().mockResolvedValue({
              accessToken: 'mock-access-token',
              refreshToken: 'mock-refresh-token',
              expiresIn: 900,
            }),
          },
        },
        {
          provide: MailService,
          useValue: { sendVerificationCode: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    tokenService = module.get<TokenService>(TokenService);
  });

  it('should throw UnauthorizedException if studentCode is not found', async () => {
    jest.spyOn(prismaService.student, 'findUnique').mockResolvedValue(null);

    await expect(
      (authService as any).loginStudent({ studentCode: '99999', pin: '1234' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if PIN does not match', async () => {
    const pinHash = await argon2.hash('1234');
    jest.spyOn(prismaService.student, 'findUnique').mockResolvedValue({
      id: 'student-1',
      studentCode: '06201',
      accessPinHash: pinHash,
      user: {
        id: 'user-1',
        email: '06201@student.afrotech.edu',
        accountStatus: 'ACTIVE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
      },
      primaryTeacher: null,
    } as any);

    await expect(
      (authService as any).loginStudent({ studentCode: '06201', pin: '0000' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should authenticate student and return tokens and profile on valid PIN', async () => {
    const pinHash = await argon2.hash('1234');
    jest.spyOn(prismaService.student, 'findUnique').mockResolvedValue({
      id: 'student-1',
      studentCode: '06201',
      firstName: 'Divine',
      lastName: 'Ekubor',
      grade: 'Grade 5',
      room: 'Room 201',
      accessPinHash: pinHash,
      user: {
        id: 'user-1',
        email: '06201@student.afrotech.edu',
        accountStatus: 'ACTIVE',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
      },
      primaryTeacher: {
        schoolName: 'Afrotech Academy',
      },
    } as any);

    const result = await (authService as any).loginStudent({
      studentCode: '06201',
      pin: '1234',
    });

    expect(result.tokens.accessToken).toBe('mock-access-token');
    expect(result.user.role).toBe('STUDENT');
    expect(result.user.profile.studentCode).toBe('06201');
    expect(result.user.profile.fullName).toBe('Divine Ekubor');
    expect(tokenService.generateTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        role: 'STUDENT',
      }),
    );

  });
});
