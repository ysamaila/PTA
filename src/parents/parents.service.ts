import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { LinkStudentDto } from './dto/link-student.dto.js';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async linkStudent(parentUserId: string, dto: LinkStudentDto) {
    const student = await this.prisma.student.findUnique({
      where: { studentCode: dto.studentCode.trim() },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID code '${dto.studentCode}' not found`,
      );
    }

    const existingLink = await this.prisma.studentParentLink.findUnique({
      where: {
        studentId_parentUserId: {
          studentId: student.id,
          parentUserId,
        },
      },
    });

    if (existingLink) {
      throw new ConflictException('This child is already linked to your account');
    }

    return this.prisma.studentParentLink.create({
      data: {
        studentId: student.id,
        parentUserId,
        relationshipType: dto.relationshipType ?? 'Parent',
        isPrimaryContact: dto.isPrimaryContact ?? false,
      },
      include: {
        student: {
          include: {
            primaryTeacher: true,
          },
        },
      },
    });
  }

  async getLinkedStudents(parentUserId: string) {
    const links = await this.prisma.studentParentLink.findMany({
      where: { parentUserId },
      include: {
        student: {
          include: {
            primaryTeacher: true,
          },
        },
      },
      orderBy: { linkedAt: 'asc' },
    });

    return links.map((link) => ({
      linkId: link.id,
      relationshipType: link.relationshipType,
      isPrimaryContact: link.isPrimaryContact,
      student: {
        id: link.student.id,
        studentCode: link.student.studentCode,
        fullName: `${link.student.firstName} ${link.student.lastName}`,
        grade: link.student.grade,
        room: link.student.room,
        avatarUrl: link.student.avatarUrl,
        teacher: link.student.primaryTeacher
          ? {
              fullName: link.student.primaryTeacher.fullName,
              schoolName: link.student.primaryTeacher.schoolName,
            }
          : null,
      },
    }));
  }

  async unlinkStudent(parentUserId: string, studentId: string) {
    const link = await this.prisma.studentParentLink.findUnique({
      where: {
        studentId_parentUserId: {
          studentId,
          parentUserId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Linked student not found');
    }

    await this.prisma.studentParentLink.delete({
      where: {
        id: link.id,
      },
    });

    return { message: 'Child unlinked successfully' };
  }
}
