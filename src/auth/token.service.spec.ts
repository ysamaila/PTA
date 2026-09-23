import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Role, AccountStatus } from '../common/enums/index.js';

describe('TokenService', () => {
  let service: TokenService;

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock_jwt_token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal: any) => defaultVal),
  };

  const mockPrismaService = {
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  describe('generateTokens', () => {
    it('should generate an access token and store a hashed refresh token', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'rt_1' });

      const res = await service.generateTokens({
        id: 'user_1',
        email: 'user@example.com',
        role: Role.PARENT,
        accountStatus: AccountStatus.ACTIVE,
      });

      expect(res.accessToken).toBe('mock_jwt_token');
      expect(res.refreshToken).toBeDefined();
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_1',
            tokenHash: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('should rotate a valid refresh token', async () => {
      const mockStoredToken = {
        id: 'rt_old',
        userId: 'user_1',
        tokenHash: 'some_hash',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
        user: {
          id: 'user_1',
          email: 'user@example.com',
          role: Role.PARENT,
          accountStatus: AccountStatus.ACTIVE,
        },
      };

      mockPrismaService.refreshToken.findFirst.mockResolvedValue(
        mockStoredToken,
      );
      mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'rt_new' });
      mockPrismaService.refreshToken.update.mockResolvedValue({ id: 'rt_old' });

      const res = await service.rotateRefreshToken('valid_token');

      expect(res.accessToken).toBe('mock_jwt_token');
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt_old' },
          data: expect.objectContaining({
            isRevoked: true,
            replacedByTokenId: 'rt_new',
          }),
        }),
      );
    });

    it('should detect reuse of a revoked token and revoke all user sessions', async () => {
      const mockRevokedToken = {
        id: 'rt_old',
        userId: 'user_1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 100000),
      };

      mockPrismaService.refreshToken.findFirst.mockResolvedValue(
        mockRevokedToken,
      );

      await expect(service.rotateRefreshToken('reused_token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_1' },
        data: { isRevoked: true },
      });
    });

    it('should reject an expired refresh token', async () => {
      const mockExpiredToken = {
        id: 'rt_old',
        userId: 'user_1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 100000),
      };

      mockPrismaService.refreshToken.findFirst.mockResolvedValue(
        mockExpiredToken,
      );

      await expect(service.rotateRefreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeToken and revokeAllUserTokens', () => {
    it('should revoke a single token', async () => {
      await service.revokeToken('token_to_revoke');
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('should revoke all tokens for a user', async () => {
      await service.revokeAllUserTokens('user_1');
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_1', isRevoked: false },
        data: { isRevoked: true },
      });
    });
  });
});
