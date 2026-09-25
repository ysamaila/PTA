import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('UsersService - Preferences', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            userPreferences: { upsert: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should update and return user preferences', async () => {
    const mockPref = {
      id: 'pref-1',
      userId: 'user-1',
      pushNotificationsEnabled: false,
      soundEnabled: true,
      darkModeEnabled: true,
      autoSyncEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest.spyOn(prisma.userPreferences, 'upsert').mockResolvedValue(mockPref as any);

    const result = await service.updatePreferences('user-1', {
      darkModeEnabled: true,
      pushNotificationsEnabled: false,
    });

    expect(result.darkModeEnabled).toBe(true);
    expect(result.pushNotificationsEnabled).toBe(false);
    expect(prisma.userPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
  });

  it('should get or create default user preferences', async () => {
    const mockPref = {
      id: 'pref-1',
      userId: 'user-1',
      pushNotificationsEnabled: true,
      soundEnabled: true,
      darkModeEnabled: false,
      autoSyncEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest.spyOn(prisma.userPreferences, 'upsert').mockResolvedValue(mockPref as any);

    const result = await service.getPreferences('user-1');
    expect(result.userId).toBe('user-1');
    expect(result.pushNotificationsEnabled).toBe(true);
  });
});
