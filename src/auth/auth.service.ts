import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { TokenService, TokenResponse } from './token.service.js';
import { RegisterParentDto } from './dto/register-parent.dto.js';
import { RegisterTeacherDto } from './dto/register-teacher.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyCodeDto } from './dto/verify-code.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import {
  Role,
  AccountStatus,
  VerificationType,
} from '../common/enums/index.js';

export interface SafeUser {
  id: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  profile?: {
    fullName: string;
    phone?: string | null;
    subjectSpecialization?: string | null;
  } | null;
}

export interface AuthResult {
  user: SafeUser;
  tokens: TokenResponse;
}

interface UserWithRelations {
  id: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  parentProfile?: {
    fullName: string;
    phone?: string | null;
  } | null;
  teacherProfile?: {
    fullName: string;
    phone?: string | null;
    subjectSpecialization?: string | null;
  } | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  private generateSixDigitCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  private sanitizeUser(user: UserWithRelations): SafeUser {
    let profileData: SafeUser['profile'] = null;
    if (user.parentProfile) {
      profileData = {
        fullName: user.parentProfile.fullName,
        phone: user.parentProfile.phone ?? null,
        subjectSpecialization: null,
      };
    } else if (user.teacherProfile) {
      profileData = {
        fullName: user.teacherProfile.fullName,
        phone: user.teacherProfile.phone ?? null,
        subjectSpecialization:
          user.teacherProfile.subjectSpecialization ?? null,
      };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      profile: profileData,
    };
  }

  async registerParent(
    dto: RegisterParentDto,
  ): Promise<{ message: string; user: SafeUser }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const code = this.generateSixDigitCode();
    const codeHash = this.tokenService.hashToken(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: Role.PARENT,
          accountStatus: AccountStatus.PENDING_VERIFICATION,
          isEmailVerified: false,
          parentProfile: {
            create: {
              fullName: dto.fullName,
              phone: dto.phone,
            },
          },
          verificationCodes: {
            create: {
              codeHash,
              type: VerificationType.EMAIL_VERIFICATION,
              expiresAt,
            },
          },
        },
        include: {
          parentProfile: true,
        },
      });

      return createdUser;
    });

    await this.mailService.sendVerificationCode(user.email, dto.fullName, code);

    return {
      message:
        'Parent registration successful. A 6-digit verification code has been sent to your email.',
      user: this.sanitizeUser(user),
    };
  }

  async registerTeacher(
    dto: RegisterTeacherDto,
  ): Promise<{ message: string; user: SafeUser }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const code = this.generateSixDigitCode();
    const codeHash = this.tokenService.hashToken(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: Role.TEACHER,
          accountStatus: AccountStatus.PENDING_VERIFICATION,
          isEmailVerified: false,
          teacherProfile: {
            create: {
              fullName: dto.fullName,
              phone: dto.phone,
              subjectSpecialization: dto.subjectSpecialization,
            },
          },
          verificationCodes: {
            create: {
              codeHash,
              type: VerificationType.EMAIL_VERIFICATION,
              expiresAt,
            },
          },
        },
        include: {
          teacherProfile: true,
        },
      });

      return createdUser;
    });

    await this.mailService.sendVerificationCode(user.email, dto.fullName, code);

    return {
      message:
        'Teacher registration successful. A 6-digit verification code has been sent to your email.',
      user: this.sanitizeUser(user),
    };
  }

  async verifyEmailCode(
    dto: VerifyCodeDto,
  ): Promise<{ message: string; user: SafeUser }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { parentProfile: true, teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (user.isEmailVerified) {
      return {
        message: 'Email address is already verified',
        user: this.sanitizeUser(user),
      };
    }

    const latestCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        type: VerificationType.EMAIL_VERIFICATION,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestCode) {
      throw new BadRequestException(
        'No pending verification code found. Please request a new one.',
      );
    }

    if (new Date() > latestCode.expiresAt) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }

    if (latestCode.attempts >= 5) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new code.',
      );
    }

    const incomingHash = this.tokenService.hashToken(dto.code.trim());
    if (incomingHash !== latestCode.codeHash) {
      await this.prisma.verificationCode.update({
        where: { id: latestCode.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code');
    }

    const nextStatus =
      user.role === Role.TEACHER
        ? AccountStatus.PENDING_APPROVAL
        : AccountStatus.ACTIVE;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.verificationCode.update({
        where: { id: latestCode.id },
        data: { usedAt: new Date() },
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          accountStatus: nextStatus,
        },
        include: {
          parentProfile: true,
          teacherProfile: true,
        },
      });
    });

    return {
      message: 'Email verified successfully',
      user: this.sanitizeUser(updatedUser),
    };
  }

  async resendVerificationCode(
    dto: ResendCodeDto,
  ): Promise<{ message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { parentProfile: true, teacherProfile: true },
    });

    if (!user) {
      return {
        message:
          'If an account exists, a new verification code has been dispatched.',
      };
    }

    if (user.isEmailVerified) {
      return { message: 'Account email is already verified.' };
    }

    const recentCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        type: VerificationType.EMAIL_VERIFICATION,
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentCode) {
      throw new BadRequestException(
        'Please wait at least 60 seconds before requesting another code.',
      );
    }

    const code = this.generateSixDigitCode();
    const codeHash = this.tokenService.hashToken(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationCode.updateMany({
        where: {
          userId: user.id,
          type: VerificationType.EMAIL_VERIFICATION,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      await tx.verificationCode.create({
        data: {
          userId: user.id,
          codeHash,
          type: VerificationType.EMAIL_VERIFICATION,
          expiresAt,
        },
      });
    });

    const recipientName =
      user.parentProfile?.fullName || user.teacherProfile?.fullName || 'User';

    await this.mailService.sendVerificationCode(
      user.email,
      recipientName,
      code,
    );

    return { message: 'Verification code resent successfully' };
  }

  async loginParent(dto: LoginDto): Promise<AuthResult> {
    return this.authenticateWithRole(dto, Role.PARENT);
  }

  async loginTeacher(dto: LoginDto): Promise<AuthResult> {
    return this.authenticateWithRole(dto, Role.TEACHER);
  }

  private async authenticateWithRole(
    dto: LoginDto,
    expectedRole: Role,
  ): Promise<AuthResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { parentProfile: true, teacherProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role !== expectedRole) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.accountStatus === AccountStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException(
        'Please verify your email address before logging in',
      );
    }

    if (user.accountStatus === AccountStatus.PENDING_APPROVAL) {
      throw new ForbiddenException(
        'Your teacher account is pending administrator approval',
      );
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended');
    }

    if (user.accountStatus === AccountStatus.DISABLED) {
      throw new ForbiddenException('Your account has been disabled');
    }

    const tokens = await this.tokenService.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { parentProfile: true, teacherProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return this.sanitizeUser(user);
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<{ message: string }> {
    if (refreshToken) {
      await this.tokenService.revokeToken(refreshToken);
    } else {
      await this.tokenService.revokeAllUserTokens(userId);
    }
    return { message: 'Logged out successfully' };
  }
}
