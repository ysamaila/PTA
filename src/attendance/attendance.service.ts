import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AttendanceStatus, Role } from '../common/enums/index.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';
import { AttendanceFilterDto } from './dto/attendance-filter.dto.js';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalize an ISO date string to UTC midnight (YYYY-MM-DDT00:00:00.000Z)
   */
  private normalizeDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Helper to aggregate counts and percentages from an array of attendance records
   */
  private calculateSummary(records: { status: AttendanceStatus }[]) {
    const total = records.length;
    const counts: Record<AttendanceStatus, number> = {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.LATE]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.EXCUSED]: 0,
    };

    for (const record of records) {
      if (counts[record.status] !== undefined) {
        counts[record.status]++;
      }
    }

    const percentages: Record<AttendanceStatus, number> = {
      [AttendanceStatus.PRESENT]:
        total > 0 ? Math.round((counts[AttendanceStatus.PRESENT] / total) * 1000) / 10 : 0,
      [AttendanceStatus.LATE]:
        total > 0 ? Math.round((counts[AttendanceStatus.LATE] / total) * 1000) / 10 : 0,
      [AttendanceStatus.ABSENT]:
        total > 0 ? Math.round((counts[AttendanceStatus.ABSENT] / total) * 1000) / 10 : 0,
      [AttendanceStatus.EXCUSED]:
        total > 0 ? Math.round((counts[AttendanceStatus.EXCUSED] / total) * 1000) / 10 : 0,
    };

    return { total, counts, percentages };
  }

  /**
   * Mark or update classroom roll call for assigned students in a batch transaction
   */
  async markClassAttendance(teacherUserId: string, dto: MarkAttendanceDto) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found for authenticated user');
    }

    const studentIds = dto.records.map((r) => r.studentId);
    const uniqueStudentIds = Array.from(new Set(studentIds));
    const validStudents = await this.prisma.student.findMany({
      where: {
        primaryTeacherId: teacherProfile.id,
        id: { in: uniqueStudentIds },
      },
    });

    if (validStudents.length !== uniqueStudentIds.length) {
      throw new BadRequestException(
        'One or more students do not belong to this teacher’s assigned class',
      );
    }

    const normalizedDate = this.normalizeDate(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const savedRecords = await Promise.all(
        dto.records.map((record) =>
          tx.attendanceRecord.upsert({
            where: {
              studentId_date: {
                studentId: record.studentId,
                date: normalizedDate,
              },
            },
            update: {
              status: record.status,
              notes: record.notes ?? null,
              teacherId: teacherProfile.id,
            },
            create: {
              studentId: record.studentId,
              teacherId: teacherProfile.id,
              date: normalizedDate,
              status: record.status,
              notes: record.notes ?? null,
            },
          }),
        ),
      );

      return {
        message: 'Classroom attendance recorded successfully',
        count: savedRecords.length,
        date: normalizedDate,
        records: savedRecords,
      };
    });
  }

  /**
   * Retrieve classroom roll call and live attendance rates for a teacher
   */
  async getClassAttendance(teacherUserId: string, filter?: AttendanceFilterDto) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found for authenticated user');
    }

    const where: any = {
      teacherId: teacherProfile.id,
    };

    if (filter?.date) {
      where.date = this.normalizeDate(filter.date);
    } else if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) {
        where.date.gte = this.normalizeDate(filter.startDate);
      }
      if (filter.endDate) {
        where.date.lte = this.normalizeDate(filter.endDate);
      }
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            grade: true,
            room: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const summary = this.calculateSummary(records);

    return {
      teacherId: teacherProfile.id,
      filterDate: filter?.date ?? null,
      summary,
      records,
    };
  }

  /**
   * Retrieve attendance history for an individual student with multi-role RBAC enforcement
   */
  async getStudentAttendance(
    requester: { id: string; role: Role },
    studentId: string,
    filter?: AttendanceFilterDto,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID '${studentId}' not found`);
    }

    // Role-based access control
    if (requester.role === Role.STUDENT) {
      if (student.userId !== requester.id) {
        throw new ForbiddenException('Students can only view their own attendance records');
      }
    } else if (requester.role === Role.PARENT) {
      const link = await this.prisma.studentParentLink.findUnique({
        where: {
          studentId_parentUserId: {
            studentId: student.id,
            parentUserId: requester.id,
          },
        },
      });

      if (!link) {
        throw new ForbiddenException(
          'You do not have permission to view attendance for this student',
        );
      }
    } else if (requester.role === Role.TEACHER) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requester.id },
      });

      if (!teacherProfile || student.primaryTeacherId !== teacherProfile.id) {
        throw new ForbiddenException(
          'Teachers can only view attendance for students in their assigned classroom',
        );
      }
    }

    const where: any = {
      studentId: student.id,
    };

    if (filter?.date) {
      where.date = this.normalizeDate(filter.date);
    } else if (filter?.startDate || filter?.endDate) {
      where.date = {};
      if (filter.startDate) {
        where.date.gte = this.normalizeDate(filter.startDate);
      }
      if (filter.endDate) {
        where.date.lte = this.normalizeDate(filter.endDate);
      }
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const summary = this.calculateSummary(records);

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentCode: student.studentCode,
        grade: student.grade,
        room: student.room,
      },
      summary,
      records,
    };
  }
}
