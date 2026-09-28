import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateHomeworkDto } from './dto/create-homework.dto.js';
import { UpdateHomeworkDto } from './dto/update-homework.dto.js';
import { HomeworkFilterDto } from './dto/homework-filter.dto.js';
import { SubmitHomeworkDto } from './dto/submit-homework.dto.js';
import { ReviewSubmissionDto } from './dto/review-submission.dto.js';
import { HomeworkStatus, SubmissionStatus } from '../common/enums/index.js';

@Injectable()
export class HomeworkService {
  private readonly logger = new Logger(HomeworkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createHomework(teacherUserId: string, dto: CreateHomeworkDto) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!teacher) {
      throw new ForbiddenException(
        'Teacher profile not found for authenticated user',
      );
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${dto.subjectId} not found`);
    }

    const homework = await this.prisma.homework.create({
      data: {
        teacherId: teacher.id,
        subjectId: dto.subjectId,
        gradeLevel: dto.gradeLevel,
        room: dto.room || null,
        title: dto.title,
        instructions: dto.instructions,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? HomeworkStatus.PUBLISHED,
        attachmentUrls: dto.attachmentUrls ?? [],
      },
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            schoolName: true,
          },
        },
      },
    });

    this.logger.log(
      `Homework created: "${homework.title}" for ${homework.gradeLevel} by Teacher ${teacher.fullName}`,
    );

    return homework;
  }

  async getTeacherHomework(
    teacherUserId: string,
    filter?: HomeworkFilterDto,
    isAdmin = false,
  ) {
    let teacherId: string | undefined;

    if (!isAdmin) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { userId: teacherUserId },
      });

      if (!teacher) {
        throw new ForbiddenException(
          'Teacher profile not found for authenticated user',
        );
      }
      teacherId = teacher.id;
    }

    const where: Prisma.HomeworkWhereInput = {};
    if (teacherId) where.teacherId = teacherId;
    if (filter?.subjectId) where.subjectId = filter.subjectId;
    if (filter?.gradeLevel) where.gradeLevel = filter.gradeLevel;
    if (filter?.room) where.room = filter.room;
    if (filter?.status) where.status = filter.status;

    const homeworkList = await this.prisma.homework.findMany({
      where,
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            schoolName: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        dueDate: 'desc',
      },
    });

    return homeworkList;
  }

  async getHomeworkById(id: string) {
    const homework = await this.prisma.homework.findUnique({
      where: { id },
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
            schoolName: true,
          },
        },
        submissions: {
          include: {
            student: {
              select: {
                id: true,
                studentCode: true,
                firstName: true,
                lastName: true,
                grade: true,
                room: true,
              },
            },
          },
        },
      },
    });

    if (!homework) {
      throw new NotFoundException(`Homework with ID ${id} not found`);
    }

    const totalSubmissions = homework.submissions.length;
    const submittedCount = homework.submissions.filter(
      (s) =>
        s.status === SubmissionStatus.SUBMITTED ||
        s.status === SubmissionStatus.REVIEWED,
    ).length;
    const reviewedCount = homework.submissions.filter(
      (s) => s.status === SubmissionStatus.REVIEWED,
    ).length;
    const parentSignedCount = homework.submissions.filter(
      (s) => s.parentSignatureVerified,
    ).length;

    return {
      ...homework,
      stats: {
        totalSubmissions,
        submittedCount,
        reviewedCount,
        parentSignedCount,
      },
    };
  }

  async updateHomework(
    id: string,
    teacherUserId: string,
    dto: UpdateHomeworkDto,
    isAdmin = false,
  ) {
    const homework = await this.prisma.homework.findUnique({
      where: { id },
    });

    if (!homework) {
      throw new NotFoundException(`Homework with ID ${id} not found`);
    }

    if (!isAdmin) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { userId: teacherUserId },
      });

      if (!teacher || homework.teacherId !== teacher.id) {
        throw new ForbiddenException(
          'You can only modify homework assignments that you created',
        );
      }
    }

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject) {
        throw new NotFoundException(
          `Subject with ID ${dto.subjectId} not found`,
        );
      }
    }

    const updated = await this.prisma.homework.update({
      where: { id },
      data: {
        ...(dto.subjectId && { subjectId: dto.subjectId }),
        ...(dto.gradeLevel && { gradeLevel: dto.gradeLevel }),
        ...(dto.room !== undefined && { room: dto.room || null }),
        ...(dto.title && { title: dto.title }),
        ...(dto.instructions && { instructions: dto.instructions }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.attachmentUrls && { attachmentUrls: dto.attachmentUrls }),
      },
      include: {
        subject: true,
      },
    });

    return updated;
  }

  async deleteHomework(id: string, teacherUserId: string, isAdmin = false) {
    const homework = await this.prisma.homework.findUnique({
      where: { id },
    });

    if (!homework) {
      throw new NotFoundException(`Homework with ID ${id} not found`);
    }

    if (!isAdmin) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { userId: teacherUserId },
      });

      if (!teacher || homework.teacherId !== teacher.id) {
        throw new ForbiddenException(
          'You can only delete homework assignments that you created',
        );
      }
    }

    await this.prisma.homework.delete({
      where: { id },
    });

    return { message: 'Homework assignment deleted successfully' };
  }

  async getStudentHomework(studentUserId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw new NotFoundException(
        'Student profile not found for authenticated user',
      );
    }

    const homeworkList = await this.prisma.homework.findMany({
      where: {
        status: HomeworkStatus.PUBLISHED,
        gradeLevel: student.grade,
        OR: [{ room: null }, { room: student.room }],
      },
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        submissions: {
          where: {
            studentId: student.id,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return homeworkList.map((hw) => {
      const submission = hw.submissions[0] || null;
      return {
        id: hw.id,
        title: hw.title,
        instructions: hw.instructions,
        gradeLevel: hw.gradeLevel,
        room: hw.room,
        dueDate: hw.dueDate,
        attachmentUrls: hw.attachmentUrls,
        createdAt: hw.createdAt,
        subject: hw.subject,
        teacher: hw.teacher,
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              completedAt: submission.completedAt,
              submissionNotes: submission.submissionNotes,
              attachmentUrls: submission.attachmentUrls,
              parentSignatureVerified: submission.parentSignatureVerified,
              parentSignedAt: submission.parentSignedAt,
            }
          : {
              status: SubmissionStatus.PENDING,
              completedAt: null,
              submissionNotes: null,
              attachmentUrls: [],
              parentSignatureVerified: false,
              parentSignedAt: null,
            },
      };
    });
  }

  async submitHomework(
    homeworkId: string,
    studentUserId: string,
    dto: SubmitHomeworkDto,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw new NotFoundException(
        'Student profile not found for authenticated user',
      );
    }

    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
    });

    if (!homework || homework.status === HomeworkStatus.ARCHIVED) {
      throw new NotFoundException('Homework assignment not found or archived');
    }

    const submission = await this.prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: student.id,
        },
      },
      create: {
        homeworkId,
        studentId: student.id,
        status: SubmissionStatus.SUBMITTED,
        completedAt: new Date(),
        submissionNotes: dto.submissionNotes || null,
        attachmentUrls: dto.attachmentUrls ?? [],
      },
      update: {
        status: SubmissionStatus.SUBMITTED,
        completedAt: new Date(),
        submissionNotes: dto.submissionNotes || null,
        attachmentUrls: dto.attachmentUrls ?? [],
      },
      include: {
        homework: {
          include: {
            subject: true,
          },
        },
      },
    });

    this.logger.log(
      `Student ${student.firstName} ${student.lastName} submitted homework "${homework.title}"`,
    );

    return submission;
  }

  async getParentStudentHomework(parentUserId: string, studentId: string) {
    const link = await this.prisma.studentParentLink.findUnique({
      where: {
        studentId_parentUserId: {
          studentId,
          parentUserId,
        },
      },
      include: {
        student: true,
      },
    });

    if (!link) {
      throw new ForbiddenException(
        'You are not authorized to view homework for this student',
      );
    }

    const student = link.student;

    const homeworkList = await this.prisma.homework.findMany({
      where: {
        status: HomeworkStatus.PUBLISHED,
        gradeLevel: student.grade,
        OR: [{ room: null }, { room: student.room }],
      },
      include: {
        subject: true,
        teacher: {
          select: {
            id: true,
            fullName: true,
          },
        },
        submissions: {
          where: {
            studentId,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return homeworkList.map((hw) => {
      const submission = hw.submissions[0] || null;
      return {
        id: hw.id,
        title: hw.title,
        instructions: hw.instructions,
        gradeLevel: hw.gradeLevel,
        room: hw.room,
        dueDate: hw.dueDate,
        attachmentUrls: hw.attachmentUrls,
        createdAt: hw.createdAt,
        subject: hw.subject,
        teacher: hw.teacher,
        submission: submission
          ? {
              id: submission.id,
              status: submission.status,
              completedAt: submission.completedAt,
              submissionNotes: submission.submissionNotes,
              attachmentUrls: submission.attachmentUrls,
              parentSignatureVerified: submission.parentSignatureVerified,
              parentSignedAt: submission.parentSignedAt,
            }
          : {
              status: SubmissionStatus.PENDING,
              completedAt: null,
              submissionNotes: null,
              attachmentUrls: [],
              parentSignatureVerified: false,
              parentSignedAt: null,
            },
      };
    });
  }

  async parentSignHomework(
    homeworkId: string,
    studentId: string,
    parentUserId: string,
  ) {
    const link = await this.prisma.studentParentLink.findUnique({
      where: {
        studentId_parentUserId: {
          studentId,
          parentUserId,
        },
      },
    });

    if (!link) {
      throw new ForbiddenException(
        'You are not authorized to sign homework for this student',
      );
    }

    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
    });

    if (!submission || submission.status === SubmissionStatus.PENDING) {
      throw new BadRequestException(
        'Cannot sign homework that has not been submitted by the student',
      );
    }

    const signed = await this.prisma.homeworkSubmission.update({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
      data: {
        parentSignatureVerified: true,
        parentSignedAt: new Date(),
        parentSignedByUserId: parentUserId,
      },
    });

    this.logger.log(
      `Parent ${parentUserId} verified signature for student ${studentId} on homework ${homeworkId}`,
    );

    return signed;
  }

  async reviewSubmission(
    homeworkId: string,
    studentId: string,
    teacherUserId: string,
    dto: ReviewSubmissionDto,
    isAdmin = false,
  ) {
    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
    });

    if (!homework) {
      throw new NotFoundException(`Homework with ID ${homeworkId} not found`);
    }

    if (!isAdmin) {
      const teacher = await this.prisma.teacherProfile.findUnique({
        where: { userId: teacherUserId },
      });

      if (!teacher || homework.teacherId !== teacher.id) {
        throw new ForbiddenException(
          'You can only review submissions for your own homework assignments',
        );
      }
    }

    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission record not found for student');
    }

    const updated = await this.prisma.homeworkSubmission.update({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
      data: {
        status: dto.status ?? SubmissionStatus.REVIEWED,
      },
    });

    return updated;
  }
}
