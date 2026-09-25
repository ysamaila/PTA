import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service.js';
import { AccountStatus, Gender, Role } from '../common/enums/index.js';
import { CreateStudentDto } from './dto/create-student.dto.js';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async createStudent(teacherUserId: string, dto: CreateStudentDto) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
      include: {
        students: true,
      },
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found for authenticated user');
    }

    if (teacherProfile.students.length >= teacherProfile.studentCapacity) {
      throw new BadRequestException(
        `Class capacity reached. Current enrollment: ${teacherProfile.students.length}/${teacherProfile.studentCapacity}`,
      );
    }

    const existingStudent = await this.prisma.student.findUnique({
      where: { studentCode: dto.studentCode },
    });

    if (existingStudent) {
      throw new ConflictException(
        `Student with ID code '${dto.studentCode}' is already registered`,
      );
    }

    const pinToHash = dto.pin || '1234';
    const accessPinHash = await argon2.hash(pinToHash);

    const studentEmail = `${dto.studentCode.toLowerCase()}@student.connected.internal`;
    const grade = dto.grade || teacherProfile.assignedGrade;
    const room = dto.room || teacherProfile.roomNumber;
    const gender = dto.gender || Gender.OTHER;
    const dateOfBirth = new Date(dto.dateOfBirth);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create or link Student User Account
      const studentUser = await tx.user.upsert({
        where: { email: studentEmail },
        update: {
          accountStatus: AccountStatus.ACTIVE,
          isEmailVerified: true,
        },
        create: {
          email: studentEmail,
          passwordHash: '',
          role: Role.STUDENT,
          accountStatus: AccountStatus.ACTIVE,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          preferences: {
            create: {
              pushNotificationsEnabled: true,
              soundEnabled: true,
              darkModeEnabled: false,
              autoSyncEnabled: true,
            },
          },
        },
      });

      // 2. Create Student Record
      const student = await tx.student.create({
        data: {
          userId: studentUser.id,
          studentCode: dto.studentCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth,
          gender,
          grade,
          room,
          accessPinHash,
          primaryTeacherId: teacherProfile.id,
        },
        include: {
          primaryTeacher: true,
        },
      });

      return {
        message: 'Student enrolled successfully in classroom roster',
        student: {
          id: student.id,
          studentCode: student.studentCode,
          fullName: `${student.firstName} ${student.lastName}`,
          firstName: student.firstName,
          lastName: student.lastName,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          grade: student.grade,
          room: student.room,
          schoolName: teacherProfile.schoolName,
          teacherName: teacherProfile.fullName,
          credentials: {
            loginMethod: 'Student Code + PIN',
            studentCode: student.studentCode,
            initialPin: pinToHash,
          },
          createdAt: student.createdAt,
        },
      };
    });
  }

  async getStudents(teacherUserId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
      include: {
        students: {
          include: {
            parentLinks: {
              include: {
                parent: {
                  include: {
                    parentProfile: true,
                  },
                },
              },
            },
          },
          orderBy: { lastName: 'asc' },
        },
      },
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found for authenticated user');
    }

    return {
      teacher: {
        id: teacherProfile.id,
        fullName: teacherProfile.fullName,
        schoolName: teacherProfile.schoolName,
        assignedGrade: teacherProfile.assignedGrade,
        roomNumber: teacherProfile.roomNumber,
        studentCapacity: teacherProfile.studentCapacity,
        enrolledCount: teacherProfile.students.length,
      },
      students: teacherProfile.students.map((s) => ({
        id: s.id,
        studentCode: s.studentCode,
        fullName: `${s.firstName} ${s.lastName}`,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        grade: s.grade,
        room: s.room,
        avatarUrl: s.avatarUrl,
        linkedParentsCount: s.parentLinks.length,
        parents: s.parentLinks.map((link) => ({
          parentName: link.parent.parentProfile?.fullName ?? link.parent.email,
          relationshipType: link.relationshipType,
          isPrimaryContact: link.isPrimaryContact,
        })),
        createdAt: s.createdAt,
      })),
    };
  }

  async getStudentById(teacherUserId: string, studentId: string) {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found for authenticated user');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        primaryTeacherId: teacherProfile.id,
      },
      include: {
        parentLinks: {
          include: {
            parent: {
              include: {
                parentProfile: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with ID '${studentId}' not found in your classroom roster`,
      );
    }

    return {
      id: student.id,
      studentCode: student.studentCode,
      fullName: `${student.firstName} ${student.lastName}`,
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      grade: student.grade,
      room: student.room,
      avatarUrl: student.avatarUrl,
      linkedParents: student.parentLinks.map((link) => ({
        parentId: link.parent.id,
        parentName: link.parent.parentProfile?.fullName ?? link.parent.email,
        relationshipType: link.relationshipType,
        isPrimaryContact: link.isPrimaryContact,
      })),
      createdAt: student.createdAt,
    };
  }
}
