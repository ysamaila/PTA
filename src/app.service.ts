import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './database/prisma.service.js';

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
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

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

  async cleanDatabase() {
    this.logger.warn('DATABASE CLEAN / RESET INITIATED VIA API');

    await this.prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        behavior_records,
        homework_submissions,
        homework,
        messages,
        conversation_participants,
        conversations,
        grade_assessments,
        subjects,
        academic_sessions,
        attendance_records,
        student_parent_links,
        user_preferences,
        verification_codes,
        refresh_tokens,
        students,
        teacher_profiles,
        parent_profiles,
        users
      CASCADE;
    `);

    const counts = await this.prisma.$queryRawUnsafe<
      Array<Record<string, number | bigint>>
    >(`
      SELECT 
        (SELECT COUNT(*) FROM users)::int as users_count,
        (SELECT COUNT(*) FROM students)::int as students_count,
        (SELECT COUNT(*) FROM teacher_profiles)::int as teachers_count,
        (SELECT COUNT(*) FROM parent_profiles)::int as parents_count,
        (SELECT COUNT(*) FROM student_parent_links)::int as links_count,
        (SELECT COUNT(*) FROM attendance_records)::int as attendance_count,
        (SELECT COUNT(*) FROM grade_assessments)::int as grades_count,
        (SELECT COUNT(*) FROM homework)::int as homework_count,
        (SELECT COUNT(*) FROM homework_submissions)::int as homework_submissions_count,
        (SELECT COUNT(*) FROM conversations)::int as conversations_count,
        (SELECT COUNT(*) FROM messages)::int as messages_count,
        (SELECT COUNT(*) FROM behavior_records)::int as behavior_count,
        (SELECT COUNT(*) FROM subjects)::int as subjects_count,
        (SELECT COUNT(*) FROM academic_sessions)::int as sessions_count;
    `);

    return {
      success: true,
      message:
        'Database cleaned successfully. All table records have been truncated.',
      timestamp: new Date().toISOString(),
      counts: counts[0] || {},
    };
  }
}
