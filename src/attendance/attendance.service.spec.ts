import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { AttendanceStatus, Role } from '../common/enums/index.js';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: PrismaService;

  const mockTeacherProfile = {
    id: 'teacher-profile-uuid-1',
    userId: 'teacher-user-uuid-1',
    fullName: 'Mr. John Doe',
    assignedGrade: 'Grade 5',
    roomNumber: 'Room 101',
  };

  const mockStudents = [
    {
      id: 'student-uuid-1',
      firstName: 'Alice',
      lastName: 'Smith',
      studentCode: '05101',
      teacherId: 'teacher-profile-uuid-1',
      userId: 'student-user-uuid-1',
    },
    {
      id: 'student-uuid-2',
      firstName: 'Bob',
      lastName: 'Jones',
      studentCode: '05102',
      teacherId: 'teacher-profile-uuid-1',
      userId: 'student-user-uuid-2',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: {
            teacherProfile: {
              findUnique: jest.fn(),
            },
            parentProfile: {
              findUnique: jest.fn(),
            },
            student: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            studentParentLink: {
              findUnique: jest.fn(),
            },
            attendanceRecord: {
              upsert: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('markClassAttendance', () => {
    it('should throw NotFoundException if teacher profile does not exist', async () => {
      jest.spyOn(prisma.teacherProfile, 'findUnique').mockResolvedValue(null);

      await expect(
        service.markClassAttendance('non-existent-user', {
          date: '2026-09-26',
          records: [
            {
              studentId: 'student-uuid-1',
              status: AttendanceStatus.PRESENT,
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if student does not belong to teacher class', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      // Student findMany returns empty array (student not under teacher)
      jest.spyOn(prisma.student, 'findMany').mockResolvedValue([]);

      await expect(
        service.markClassAttendance(mockTeacherProfile.userId, {
          date: '2026-09-26',
          records: [
            {
              studentId: 'external-student-uuid',
              status: AttendanceStatus.PRESENT,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should atomically upsert roll call and return summary when valid', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest
        .spyOn(prisma.student, 'findMany')
        .mockResolvedValue([mockStudents[0]] as any);

      const mockUpsertedRecord = {
        id: 'rec-uuid-1',
        studentId: 'student-uuid-1',
        teacherId: mockTeacherProfile.id,
        markedById: mockTeacherProfile.id,
        date: new Date('2026-09-26T00:00:00.000Z'),
        status: AttendanceStatus.PRESENT,
        notes: 'On time',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(prisma.attendanceRecord, 'upsert')
        .mockResolvedValue(mockUpsertedRecord as any);

      const result = await service.markClassAttendance(
        mockTeacherProfile.userId,
        {
          date: '2026-09-26',
          records: [
            {
              studentId: 'student-uuid-1',
              status: AttendanceStatus.PRESENT,
              notes: 'On time',
            },
          ],
        },
      );

      expect(result).toBeDefined();
      expect(result.count).toBe(1);
      expect(result.records).toHaveLength(1);
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClassAttendance', () => {
    it('should throw NotFoundException if teacher profile does not exist', async () => {
      jest.spyOn(prisma.teacherProfile, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getClassAttendance('non-existent-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate live classroom attendance percentages correctly', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);

      const mockRecords = [
        {
          id: 'rec-1',
          studentId: 'student-uuid-1',
          teacherId: mockTeacherProfile.id,
          status: AttendanceStatus.PRESENT,
          date: new Date('2026-09-26T00:00:00.000Z'),
          student: mockStudents[0],
        },
        {
          id: 'rec-2',
          studentId: 'student-uuid-2',
          teacherId: mockTeacherProfile.id,
          status: AttendanceStatus.LATE,
          date: new Date('2026-09-26T00:00:00.000Z'),
          student: mockStudents[1],
        },
      ];

      jest
        .spyOn(prisma.attendanceRecord, 'findMany')
        .mockResolvedValue(mockRecords as any);

      const result = await service.getClassAttendance(
        mockTeacherProfile.userId,
        {
          date: '2026-09-26',
        },
      );

      expect(result).toBeDefined();
      expect(result.summary.total).toBe(2);
      expect(result.summary.counts.PRESENT).toBe(1);
      expect(result.summary.counts.LATE).toBe(1);
      expect(result.summary.percentages.PRESENT).toBe(50);
      expect(result.summary.percentages.LATE).toBe(50);
      expect(result.summary.percentages.ABSENT).toBe(0);
      expect(result.summary.percentages.EXCUSED).toBe(0);
    });
  });

  describe('getStudentAttendance (RBAC)', () => {
    it('should throw NotFoundException if student does not exist', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getStudentAttendance(
          { id: 'admin-id', role: Role.ADMIN },
          'non-existent-student',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow Admin to view any student attendance', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudents[0] as any);
      jest.spyOn(prisma.attendanceRecord, 'findMany').mockResolvedValue([]);

      const result = await service.getStudentAttendance(
        { id: 'admin-id', role: Role.ADMIN },
        mockStudents[0].id,
      );

      expect(result).toBeDefined();
      expect(result.student.id).toBe(mockStudents[0].id);
    });

    it('should allow Student to view their own attendance', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudents[0] as any);
      jest.spyOn(prisma.attendanceRecord, 'findMany').mockResolvedValue([]);

      const result = await service.getStudentAttendance(
        { id: mockStudents[0].userId, role: Role.STUDENT },
        mockStudents[0].id,
      );

      expect(result).toBeDefined();
      expect(result.student.id).toBe(mockStudents[0].id);
    });

    it('should forbid Student from viewing another student attendance', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudents[1] as any);

      await expect(
        service.getStudentAttendance(
          { id: mockStudents[0].userId, role: Role.STUDENT },
          mockStudents[1].id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Parent to view their linked child attendance', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudents[0] as any);
      jest
        .spyOn(prisma.parentProfile, 'findUnique')
        .mockResolvedValue({ id: 'parent-profile-1' } as any);
      jest
        .spyOn(prisma.studentParentLink, 'findUnique')
        .mockResolvedValue({ id: 'link-1' } as any);
      jest.spyOn(prisma.attendanceRecord, 'findMany').mockResolvedValue([]);

      const result = await service.getStudentAttendance(
        { id: 'parent-user-1', role: Role.PARENT },
        mockStudents[0].id,
      );

      expect(result).toBeDefined();
    });

    it('should forbid Parent from viewing an unlinked child attendance', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudents[0] as any);
      jest
        .spyOn(prisma.parentProfile, 'findUnique')
        .mockResolvedValue({ id: 'parent-profile-1' } as any);
      jest.spyOn(prisma.studentParentLink, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getStudentAttendance(
          { id: 'parent-user-1', role: Role.PARENT },
          mockStudents[0].id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forbid Teacher from viewing students outside their assigned class', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudents[0] as any);
      jest.spyOn(prisma.teacherProfile, 'findUnique').mockResolvedValue({
        id: 'other-teacher-profile',
      } as any);

      await expect(
        service.getStudentAttendance(
          { id: 'other-teacher-user', role: Role.TEACHER },
          mockStudents[0].id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
