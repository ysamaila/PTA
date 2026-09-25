import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TeachersService } from './teachers.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Gender, Role, AccountStatus } from '../common/enums/index.js';

describe('TeachersService', () => {
  let service: TeachersService;
  let prisma: PrismaService;

  const mockTeacherProfile = {
    id: 'teacher-profile-uuid-1',
    userId: 'teacher-user-uuid-1',
    fullName: 'Miss Edith Robinson',
    schoolName: 'Afrotech Academy',
    assignedGrade: 'Grade 5',
    roomNumber: 'Room 201',
    studentCapacity: 35,
    students: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachersService,
        {
          provide: PrismaService,
          useValue: {
            teacherProfile: {
              findUnique: jest.fn(),
            },
            student: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            $transaction: jest.fn((cb) =>
              cb({
                user: {
                  upsert: jest.fn().mockResolvedValue({
                    id: 'student-user-uuid-1',
                    email: '06201@student.connected.internal',
                    role: Role.STUDENT,
                    accountStatus: AccountStatus.ACTIVE,
                  }),
                },
                student: {
                  create: jest.fn().mockImplementation(({ data }) =>
                    Promise.resolve({
                      id: 'student-uuid-1',
                      ...data,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    }),
                  ),
                },
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<TeachersService>(TeachersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createStudent', () => {
    it('should successfully create and enroll a student in teacher classroom', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(null);

      const result = await service.createStudent('teacher-user-uuid-1', {
        firstName: 'Divine',
        lastName: 'Ekubor',
        studentCode: '06201',
        dateOfBirth: '2014-05-14',
        gender: Gender.MALE,
        pin: '1234',
      });

      expect(result).toBeDefined();
      expect(result.message).toContain('enrolled successfully');
      expect(result.student.studentCode).toBe('06201');
      expect(result.student.fullName).toBe('Divine Ekubor');
      expect(result.student.grade).toBe('Grade 5');
      expect(result.student.room).toBe('Room 201');
      expect(result.student.credentials.initialPin).toBe('1234');
    });

    it('should throw NotFoundException if teacher profile does not exist', async () => {
      jest.spyOn(prisma.teacherProfile, 'findUnique').mockResolvedValue(null);

      await expect(
        service.createStudent('non-existent-teacher', {
          firstName: 'Divine',
          lastName: 'Ekubor',
          studentCode: '06201',
          dateOfBirth: '2014-05-14',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if studentCode is already registered', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue({
        id: 'existing-student-id',
        studentCode: '06201',
      } as any);

      await expect(
        service.createStudent('teacher-user-uuid-1', {
          firstName: 'Divine',
          lastName: 'Ekubor',
          studentCode: '06201',
          dateOfBirth: '2014-05-14',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if class capacity is reached', async () => {
      const fullClassProfile = {
        ...mockTeacherProfile,
        studentCapacity: 2,
        students: [{ id: 's1' }, { id: 's2' }],
      };
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(fullClassProfile as any);

      await expect(
        service.createStudent('teacher-user-uuid-1', {
          firstName: 'Divine',
          lastName: 'Ekubor',
          studentCode: '06201',
          dateOfBirth: '2014-05-14',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStudents', () => {
    it('should return teacher classroom roster with enrollment counts', async () => {
      const populatedTeacherProfile = {
        ...mockTeacherProfile,
        students: [
          {
            id: 's1',
            studentCode: '06201',
            firstName: 'Divine',
            lastName: 'Ekubor',
            gender: Gender.MALE,
            dateOfBirth: new Date('2014-05-14'),
            grade: 'Grade 5',
            room: 'Room 201',
            avatarUrl: null,
            parentLinks: [],
            createdAt: new Date(),
          },
        ],
      };

      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(populatedTeacherProfile as any);

      const result = await service.getStudents('teacher-user-uuid-1');

      expect(result).toBeDefined();
      expect(result.teacher.enrolledCount).toBe(1);
      expect(result.students).toHaveLength(1);
      expect(result.students[0].fullName).toBe('Divine Ekubor');
    });
  });

  describe('getStudentById', () => {
    it('should return single student details if belonging to teacher roster', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest.spyOn(prisma.student, 'findFirst').mockResolvedValue({
        id: 's1',
        studentCode: '06201',
        firstName: 'Divine',
        lastName: 'Ekubor',
        gender: Gender.MALE,
        dateOfBirth: new Date('2014-05-14'),
        grade: 'Grade 5',
        room: 'Room 201',
        avatarUrl: null,
        parentLinks: [],
        createdAt: new Date(),
      } as any);

      const result = await service.getStudentById('teacher-user-uuid-1', 's1');
      expect(result.id).toBe('s1');
      expect(result.studentCode).toBe('06201');
    });

    it('should throw NotFoundException if student is not found in teacher roster', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest.spyOn(prisma.student, 'findFirst').mockResolvedValue(null);

      await expect(
        service.getStudentById('teacher-user-uuid-1', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
