import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class KeepAliveService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(KeepAliveService.name);
  private targetUrl: string;
  private bootstrapTimer?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    const configuredUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('RENDER_EXTERNAL_URL') ||
      'https://pta-wdln.onrender.com';

    this.targetUrl = configuredUrl.replace(/\/+$/, '');
  }

  onApplicationBootstrap() {
    this.bootstrapTimer = setTimeout(() => {
      void this.executeKeepAlivePing();
    }, 5000);
    this.bootstrapTimer.unref();
  }

  onModuleDestroy() {
    if (this.bootstrapTimer) {
      clearTimeout(this.bootstrapTimer);
    }
  }

  getTargetUrl(): string {
    return this.targetUrl;
  }

  @Cron('*/8 * * * *')
  async handleCron(): Promise<void> {
    await this.executeKeepAlivePing();
  }

  async executeKeepAlivePing(): Promise<{
    status: number;
    latencyMs: number;
    body: string;
  } | null> {
    const url = `${this.targetUrl}/`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'PTA-KeepAlive/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;
      const responseBody = await response.text();
      const statusText = response.ok ? 'OK' : 'FAIL';

      this.logger.log(
        `Keep-alive ping sent to ${url} [Status: ${response.status} ${statusText} | Latency: ${latencyMs}ms | Response: "${responseBody.trim()}"]`,
      );

      return {
        status: response.status,
        latencyMs,
        body: responseBody,
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      this.logger.warn(
        `Keep-alive ping to ${url} encountered an issue [Latency: ${latencyMs}ms]: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
