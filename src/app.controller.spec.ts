import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
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
  });
});

