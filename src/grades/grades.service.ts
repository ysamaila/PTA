import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AssessmentType, Role } from '../common/enums/index.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CreateAssessmentDto } from './dto/create-assessment.dto.js';
import { GradeFilterDto } from './dto/grade-filter.dto.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import {
  calculateGradeLetter,
  calculatePercentage,
  evaluateStudentBadges,
} from './utils/grade-calculator.js';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to normalize date strings to Date object
   */
  private parseDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  // ==========================================
  // ACADEMIC SESSIONS & CURRICULUM SUBJECTS
  // ==========================================

  async createSession(dto: CreateSessionDto) {
    if (dto.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicSession.create({
      data: {
        sessionYear: dto.sessionYear,
        termName: dto.termName,
        isCurrent: dto.isCurrent ?? false,
        startDate: this.parseDate(dto.startDate),
        endDate: this.parseDate(dto.endDate),
      },
    });
  }

  async getSessions() {
    return this.prisma.academicSession.findMany({
      orderBy: [{ sessionYear: 'desc' }, { termName: 'desc' }],
    });
  }

  async createSubject(dto: CreateSubjectDto) {
    return this.prisma.subject.create({
      data: {
        name: dto.name,
        code: dto.code ?? null,
      },
    });
  }

  async getSubjects() {
    return this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // ==========================================
  // CONTINUOUS ASSESSMENT & GRADE RECORDING (GRD-01)
  // ==========================================

  async recordAssessment(teacherUserId: string, dto: CreateAssessmentDto) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!teacherProfile) {
      throw new NotFoundException(
        'Teacher profile not found for authenticated user',
      );
    }

    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID '${dto.studentId}' not found`,
      );
    }

    if (student.primaryTeacherId !== teacherProfile.id) {
      throw new BadRequestException(
        'Student is not enrolled in your assigned classroom roster',
      );
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject) {
      throw new NotFoundException(
        `Subject with ID '${dto.subjectId}' not found`,
      );
    }

    const academicSession = await this.prisma.academicSession.findUnique({
      where: { id: dto.academicSessionId },
    });

    if (!academicSession) {
      throw new NotFoundException(
        `Academic session with ID '${dto.academicSessionId}' not found`,
      );
    }

    const totalPossibleMarks = dto.totalPossibleMarks ?? 100.0;
    const percentage = calculatePercentage(dto.score, totalPossibleMarks);
    const gradeLetter = calculateGradeLetter(percentage);

    const saved = await this.prisma.gradeAssessment.create({
      data: {
        studentId: student.id,
        subjectId: subject.id,
        academicSessionId: academicSession.id,
        teacherId: teacherProfile.id,
        assessmentType: dto.assessmentType,
        assessmentTitle: dto.assessmentTitle,
        score: dto.score,
        totalPossibleMarks,
        gradeLetter,
        evaluationDate: this.parseDate(dto.evaluationDate),
        notes: dto.notes ?? null,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        subject: true,
        academicSession: true,
      },
    });

    return {
      message: 'Grade assessment recorded successfully',
      percentage,
      gradeLetter,
      record: saved,
    };
  }

  // ==========================================
  // CLASSROOM GRADEBOOK & STATISTICS
  // ==========================================

  async getClassGrades(teacherUserId: string, filter?: GradeFilterDto) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!teacherProfile) {
      throw new NotFoundException(
        'Teacher profile not found for authenticated user',
      );
    }

    const where: any = {
      teacherId: teacherProfile.id,
    };

    if (filter?.studentId) where.studentId = filter.studentId;
    if (filter?.subjectId) where.subjectId = filter.subjectId;
    if (filter?.academicSessionId)
      where.academicSessionId = filter.academicSessionId;
    if (filter?.assessmentType) where.assessmentType = filter.assessmentType;

    const assessments = await this.prisma.gradeAssessment.findMany({
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
        subject: true,
        academicSession: true,
      },
      orderBy: { evaluationDate: 'desc' },
    });

    const totalRecords = assessments.length;
    let averageScore = 0;
    let highestScore = 0;
    let lowestScore = 0;

    if (totalRecords > 0) {
      const percentages = assessments.map((a) =>
        calculatePercentage(a.score, a.totalPossibleMarks),
      );
      const sum = percentages.reduce((acc, curr) => acc + curr, 0);
      averageScore = Math.round((sum / totalRecords) * 10) / 10;
      highestScore = Math.max(...percentages);
      lowestScore = Math.min(...percentages);
    }

    return {
      teacherId: teacherProfile.id,
      summary: {
        totalRecords,
        averageScore,
        highestScore,
        lowestScore,
      },
      assessments,
    };
  }

  // ==========================================
  // STUDENT REPORT CARD & BADGES (GRD-02, GRD-05)
  // ==========================================

  async getStudentReportCard(
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

    // Role-based access control
    if (requester.role === Role.STUDENT) {
      if (student.userId !== requester.id) {
        throw new ForbiddenException(
          'Students can only view their own report card',
        );
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
          'You do not have permission to view grades for this student',
        );
      }
    } else if (requester.role === Role.TEACHER) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: requester.id },
      });

      if (!teacherProfile || student.primaryTeacherId !== teacherProfile.id) {
        throw new ForbiddenException(
          'Teachers can only view grades for students in their assigned classroom',
        );
      }
    }

    let targetSession = null;
    if (sessionId) {
      targetSession = await this.prisma.academicSession.findUnique({
        where: { id: sessionId },
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

    const where: any = {
      studentId: student.id,
    };
    if (targetSession) {
      where.academicSessionId = targetSession.id;
    }

    const rawGrades = await this.prisma.gradeAssessment.findMany({
      where,
      include: {
        subject: true,
      },
      orderBy: { evaluationDate: 'asc' },
    });

    // Group assessments by subject
    const subjectMap: Record<
      string,
      {
        subjectId: string;
        subjectName: string;
        subjectCode: string | null;
        caAssessments: any[];
        examAssessments: any[];
      }
    > = {};

    let hasPerfectScore = false;

    for (const g of rawGrades) {
      if (!subjectMap[g.subjectId]) {
        subjectMap[g.subjectId] = {
          subjectId: g.subjectId,
          subjectName: g.subject.name,
          subjectCode: g.subject.code,
          caAssessments: [],
          examAssessments: [],
        };
      }

      const percentage = calculatePercentage(g.score, g.totalPossibleMarks);
      if (g.score >= g.totalPossibleMarks) {
        hasPerfectScore = true;
      }

      const item = {
        id: g.id,
        title: g.assessmentTitle,
        type: g.assessmentType,
        score: g.score,
        totalPossibleMarks: g.totalPossibleMarks,
        percentage,
        gradeLetter: g.gradeLetter || calculateGradeLetter(percentage),
        notes: g.notes,
        evaluationDate: g.evaluationDate,
      };

      if (g.assessmentType === AssessmentType.EXAM) {
        subjectMap[g.subjectId].examAssessments.push(item);
      } else {
        subjectMap[g.subjectId].caAssessments.push(item);
      }
    }

    const subjectReports = Object.values(subjectMap).map((sub) => {
      const caPercentages = sub.caAssessments.map((a) => a.percentage);
      const examPercentages = sub.examAssessments.map((a) => a.percentage);

      const caAverage =
        caPercentages.length > 0
          ? Math.round(
              (caPercentages.reduce((a, b) => a + b, 0) /
                caPercentages.length) *
                10,
            ) / 10
          : 0;

      const examAverage =
        examPercentages.length > 0
          ? Math.round(
              (examPercentages.reduce((a, b) => a + b, 0) /
                examPercentages.length) *
                10,
            ) / 10
          : 0;

      let overallAverage = 0;
      if (caPercentages.length > 0 && examPercentages.length > 0) {
        overallAverage = Math.round(((caAverage + examAverage) / 2) * 10) / 10;
      } else if (caPercentages.length > 0) {
        overallAverage = caAverage;
      } else if (examPercentages.length > 0) {
        overallAverage = examAverage;
      }

      return {
        subjectId: sub.subjectId,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        continuousAssessmentAverage: caAverage,
        examAverage: examAverage,
        overallAverage,
        gradeLetter: calculateGradeLetter(overallAverage),
        caAssessments: sub.caAssessments,
        examAssessments: sub.examAssessments,
      };
    });

    const overallAverageSum = subjectReports.reduce(
      (acc, curr) => acc + curr.overallAverage,
      0,
    );
    const overallTermAverage =
      subjectReports.length > 0
        ? Math.round((overallAverageSum / subjectReports.length) * 10) / 10
        : 0;

    const badges = evaluateStudentBadges(
      subjectReports.map((s) => ({
        subjectName: s.subjectName,
        averagePercentage: s.overallAverage,
      })),
      overallTermAverage,
      hasPerfectScore,
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
      academicSession: targetSession,
      summary: {
        overallAverage: overallTermAverage,
        overallGradeLetter: calculateGradeLetter(overallTermAverage),
        totalSubjects: subjectReports.length,
      },
      badges,
      subjects: subjectReports,
    };
  }
}
