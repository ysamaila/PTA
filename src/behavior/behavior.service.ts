import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { BehaviorCategory, Role } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { EvaluateBehaviorDto } from './dto/evaluate-behavior.dto.js';
import { UpdateBehaviorDto } from './dto/update-behavior.dto.js';
import { BehaviorFilterDto } from './dto/behavior-filter.dto.js';
import {
  calculateBehaviorRating,
  evaluateBehaviorBadges,
} from './utils/behavior-evaluator.js';

@Injectable()
export class BehaviorService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  // ==========================================
  // EVALUATION RECORDING (UPSERT)
  // ==========================================

  async evaluateBehavior(
    requesterId: string,
    requesterRole: Role,
    dto: EvaluateBehaviorDto,
  ) {
    let teacherProfileId: string;

    if (requesterRole === Role.TEACHER) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requesterId },
      });
      if (!teacherProfile) {
        throw new NotFoundException('Teacher profile not found for authenticated user');
      }
      teacherProfileId = teacherProfile.id;
    } else {
      // Role is ADMIN
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requesterId },
      });
      if (teacherProfile) {
        teacherProfileId = teacherProfile.id;
      } else {
        const anyTeacher = await this.prisma.teacherProfile.findFirst();
        if (!anyTeacher) {
          throw new BadRequestException('No teacher profile available to assign evaluation');
        }
        teacherProfileId = anyTeacher.id;
      }
    }

    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID '${dto.studentId}' not found`);
    }

    if (requesterRole === Role.TEACHER) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { id: teacherProfileId },
      });
      if (
        student.primaryTeacherId !== teacherProfileId &&
        student.grade !== teacherProfile?.assignedGrade
      ) {
        throw new BadRequestException('Student is not enrolled in your assigned classroom roster');
      }
    }

    const session = await this.prisma.academicSession.findUnique({
      where: { id: dto.academicSessionId },
    });
    if (!session) {
      throw new NotFoundException(
        `Academic session with ID '${dto.academicSessionId}' not found`,
      );
    }

    const evaluationDate = this.parseDate(dto.evaluationDate);
    const rating = calculateBehaviorRating(dto.score);

    const saved = await this.prisma.behaviorRecord.upsert({
      where: {
        studentId_academicSessionId_category: {
          studentId: student.id,
          academicSessionId: session.id,
          category: dto.category,
        },
      },
      update: {
        score: dto.score,
        remarks: dto.remarks ?? null,
        teacherId: teacherProfileId,
        evaluationDate,
      },
      create: {
        studentId: student.id,
        academicSessionId: session.id,
        category: dto.category,
        score: dto.score,
        remarks: dto.remarks ?? null,
        teacherId: teacherProfileId,
        evaluationDate,
      },
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
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        academicSession: {
          select: {
            id: true,
            sessionYear: true,
            termName: true,
          },
        },
      },
    });

    return {
      message: 'Behavior evaluation recorded successfully',
      rating: rating.rating,
      ratingLabel: rating.label,
      record: saved,
    };
  }

  // ==========================================
  // STUDENT BEHAVIOR REPORT & BADGES
  // ==========================================

  async getStudentBehavior(
    requester: AuthenticatedUser,
    studentId: string,
    sessionId?: string,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID '${studentId}' not found`);
    }

    // Role-based authorization
    if (requester.role === Role.STUDENT) {
      if (student.userId !== requester.id) {
        throw new ForbiddenException('Students can only view their own behavior records');
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
          'You do not have permission to view behavior records for this student',
        );
      }
    } else if (requester.role === Role.TEACHER) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requester.id },
      });
      if (
        !teacherProfile ||
        (student.primaryTeacherId !== teacherProfile.id &&
          student.grade !== teacherProfile.assignedGrade)
      ) {
        throw new ForbiddenException(
          'Teachers can only view behavior records for students in their assigned classroom',
        );
      }
    }

    // Resolve target session
    let targetSession = null;
    if (sessionId) {
      targetSession = await this.prisma.academicSession.findUnique({
        where: { id: sessionId },
      });
      if (!targetSession) {
        throw new NotFoundException(`Academic session with ID '${sessionId}' not found`);
      }
    } else {
      targetSession = await this.prisma.academicSession.findFirst({
        where: { isCurrent: true },
      });
      if (!targetSession) {
        targetSession = await this.prisma.academicSession.findFirst({
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    const where: any = { studentId: student.id };
    if (targetSession) {
      where.academicSessionId = targetSession.id;
    }

    const rawRecords = await this.prisma.behaviorRecord.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        academicSession: {
          select: {
            id: true,
            sessionYear: true,
            termName: true,
          },
        },
      },
      orderBy: { category: 'asc' },
    });

    const formattedRecords = rawRecords.map((r) => {
      const rating = calculateBehaviorRating(r.score);
      return {
        id: r.id,
        category: r.category,
        score: r.score,
        remarks: r.remarks,
        rating: rating.rating,
        ratingLabel: rating.label,
        evaluationDate: r.evaluationDate,
        teacher: r.teacher,
      };
    });

    const totalScore = rawRecords.reduce((sum, r) => sum + r.score, 0);
    const overallAverageScore =
      rawRecords.length > 0 ? Math.round((totalScore / rawRecords.length) * 10) / 10 : 0;
    const overallRating = calculateBehaviorRating(overallAverageScore);
    const badges = evaluateBehaviorBadges(
      rawRecords.map((r) => ({ category: r.category, score: r.score })),
      overallAverageScore,
    );

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentCode: student.studentCode,
        grade: student.grade,
        room: student.room,
      },
      session: targetSession
        ? {
            id: targetSession.id,
            sessionYear: targetSession.sessionYear,
            termName: targetSession.termName,
            isCurrent: targetSession.isCurrent,
          }
        : null,
      overallAverageScore,
      overallRating: overallRating.rating,
      overallRatingLabel: overallRating.label,
      badges,
      categoriesEvaluated: `${rawRecords.length}/4`,
      records: formattedRecords,
    };
  }

  // ==========================================
  // CLASSROOM BEHAVIOR MATRIX & ANALYTICS
  // ==========================================

  async getClassroomBehavior(
    requester: AuthenticatedUser,
    filter?: BehaviorFilterDto,
  ) {
    let studentWhere: any = {};

    if (requester.role === Role.TEACHER) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requester.id },
      });
      if (!teacherProfile) {
        throw new NotFoundException('Teacher profile not found for authenticated user');
      }

      studentWhere = {
        OR: [
          { primaryTeacherId: teacherProfile.id },
          { grade: teacherProfile.assignedGrade, room: teacherProfile.roomNumber },
        ],
      };
    } else {
      // ADMIN
      if (filter?.gradeLevel) studentWhere.grade = filter.gradeLevel;
      if (filter?.room) studentWhere.room = filter.room;
    }

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      orderBy: [{ grade: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });

    // Resolve target session
    let targetSession = null;
    if (filter?.academicSessionId) {
      targetSession = await this.prisma.academicSession.findUnique({
        where: { id: filter.academicSessionId },
      });
    } else {
      targetSession = await this.prisma.academicSession.findFirst({
        where: { isCurrent: true },
      });
      if (!targetSession) {
        targetSession = await this.prisma.academicSession.findFirst({
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    const studentIds = students.map((s) => s.id);
    const recordsWhere: any = {
      studentId: { in: studentIds },
    };
    if (targetSession) {
      recordsWhere.academicSessionId = targetSession.id;
    }
    if (filter?.category) {
      recordsWhere.category = filter.category;
    }

    const behaviorRecords = await this.prisma.behaviorRecord.findMany({
      where: recordsWhere,
    });

    const recordsByStudent: Record<string, typeof behaviorRecords> = {};
    for (const record of behaviorRecords) {
      if (!recordsByStudent[record.studentId]) {
        recordsByStudent[record.studentId] = [];
      }
      recordsByStudent[record.studentId].push(record);
    }

    let classTotalScore = 0;
    let studentsWithRecordsCount = 0;
    let highPerformersCount = 0;
    let needsGuidanceCount = 0;

    const classroomMatrix = students.map((student) => {
      const records = recordsByStudent[student.id] || [];
      const scoreMap: Record<string, number | null> = {
        [BehaviorCategory.TEAMWORK]: null,
        [BehaviorCategory.COMMUNICATION]: null,
        [BehaviorCategory.RESPECT]: null,
        [BehaviorCategory.RESPONSIBILITY]: null,
      };

      for (const r of records) {
        scoreMap[r.category] = r.score;
      }

      let averageScore = 0;
      if (records.length > 0) {
        const sum = records.reduce((acc, r) => acc + r.score, 0);
        averageScore = Math.round((sum / records.length) * 10) / 10;
        classTotalScore += averageScore;
        studentsWithRecordsCount++;

        if (averageScore >= 85) highPerformersCount++;
        if (averageScore < 50) needsGuidanceCount++;
      }

      const rating = calculateBehaviorRating(averageScore);
      const badges = evaluateBehaviorBadges(
        records.map((r) => ({ category: r.category, score: r.score })),
        averageScore,
      );

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentCode: student.studentCode,
        grade: student.grade,
        room: student.room,
        scores: scoreMap,
        averageScore: records.length > 0 ? averageScore : null,
        rating: records.length > 0 ? rating.rating : null,
        ratingLabel: records.length > 0 ? rating.label : null,
        badges,
        evaluatedCount: records.length,
      };
    });

    const classAverageScore =
      studentsWithRecordsCount > 0
        ? Math.round((classTotalScore / studentsWithRecordsCount) * 10) / 10
        : 0;

    return {
      session: targetSession
        ? {
            id: targetSession.id,
            sessionYear: targetSession.sessionYear,
            termName: targetSession.termName,
            isCurrent: targetSession.isCurrent,
          }
        : null,
      classSummary: {
        totalStudents: students.length,
        evaluatedStudents: studentsWithRecordsCount,
        classAverageScore,
        highPerformersCount,
        needsGuidanceCount,
      },
      students: classroomMatrix,
    };
  }

  // ==========================================
  // UPDATE EVALUATION
  // ==========================================

  async updateBehavior(
    requesterId: string,
    recordId: string,
    dto: UpdateBehaviorDto,
    isAdmin = false,
  ) {
    const record = await this.prisma.behaviorRecord.findUnique({
      where: { id: recordId },
      include: { teacher: true },
    });

    if (!record) {
      throw new NotFoundException(`Behavior record with ID '${recordId}' not found`);
    }

    if (!isAdmin) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requesterId },
      });
      if (!teacherProfile || record.teacherId !== teacherProfile.id) {
        throw new ForbiddenException(
          'You can only update behavior evaluations you recorded',
        );
      }
    }

    const updatedData: any = {};
    if (dto.score !== undefined) {
      updatedData.score = dto.score;
    }
    if (dto.remarks !== undefined) {
      updatedData.remarks = dto.remarks;
    }

    const updated = await this.prisma.behaviorRecord.update({
      where: { id: recordId },
      data: updatedData,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        academicSession: true,
      },
    });

    const rating = calculateBehaviorRating(updated.score);

    return {
      message: 'Behavior record updated successfully',
      rating: rating.rating,
      ratingLabel: rating.label,
      record: updated,
    };
  }

  // ==========================================
  // DELETE EVALUATION
  // ==========================================

  async deleteBehavior(requesterId: string, recordId: string, isAdmin = false) {
    const record = await this.prisma.behaviorRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException(`Behavior record with ID '${recordId}' not found`);
    }

    if (!isAdmin) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requesterId },
      });
      if (!teacherProfile || record.teacherId !== teacherProfile.id) {
        throw new ForbiddenException(
          'You can only delete behavior evaluations you recorded',
        );
      }
    }

    await this.prisma.behaviorRecord.delete({
      where: { id: recordId },
    });

    return {
      message: 'Behavior record deleted successfully',
      recordId,
    };
  }
}
