import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppDetails {
  name: string;
  description: string;
  version: string;
  status: string;
  environment: string;
  docs: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getAppDetails(): AppDetails {
    return {
      name: 'ConnectEd API',
      description:
        'Parent-Teacher-Student Collaboration & School Management Platform API',
      version: '1.0.0',
      status: 'active',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      docs: '/api/docs',
      timestamp: new Date().toISOString(),
    };
  }

  getHello(): string {
    return 'Hello World!';
  }
}

