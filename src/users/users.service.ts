import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { UpdateUserPreferencesDto } from './dto/update-preferences.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: {
        ...(dto.pushNotificationsEnabled !== undefined && {
          pushNotificationsEnabled: dto.pushNotificationsEnabled,
        }),
        ...(dto.soundEnabled !== undefined && {
          soundEnabled: dto.soundEnabled,
        }),
        ...(dto.darkModeEnabled !== undefined && {
          darkModeEnabled: dto.darkModeEnabled,
        }),
        ...(dto.autoSyncEnabled !== undefined && {
          autoSyncEnabled: dto.autoSyncEnabled,
        }),
      },
      create: {
        userId,
        ...dto,
      },
    });
  }
}
