import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './database/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ users_count: 0 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: string) => defaultValue ?? 'test',
            ),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return app details JSON', () => {
      const result = appController.getAppDetails();
      expect(result).toHaveProperty('name', 'ConnectEd API');
      expect(result).toHaveProperty('status', 'active');
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('docs', '/api/docs');
      expect(result).toHaveProperty('timestamp');
    });

    it('should clean database and return success response', async () => {
      const result = await appController.cleanDatabasePost();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Database cleaned successfully');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });
});
