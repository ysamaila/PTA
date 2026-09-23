import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeepAliveService } from './keep-alive.service.js';

describe('KeepAliveService', () => {
  let service: KeepAliveService;
  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'APP_URL') return 'https://pta-wdln.onrender.com';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeepAliveService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<KeepAliveService>(KeepAliveService);
  });

  it('should initialize with configured target URL', () => {
    expect(service.getTargetUrl()).toBe('https://pta-wdln.onrender.com');
  });

  it('should execute keep-alive ping successfully', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('Hello World!'),
    };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await service.executeKeepAlivePing();

    expect(result).toBeDefined();
    expect(result?.status).toBe(200);
    expect(result?.body).toBe('Hello World!');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://pta-wdln.onrender.com/',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should handle ping network errors gracefully without throwing', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network unreachable'));

    const result = await service.executeKeepAlivePing();

    expect(result).toBeNull();
  });

  it('should trigger handleCron and call executeKeepAlivePing', async () => {
    const spy = jest
      .spyOn(service, 'executeKeepAlivePing')
      .mockResolvedValue(null);
    await service.handleCron();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
