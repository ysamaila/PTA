import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BehaviorService } from './behavior.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AccountStatus,
  BehaviorCategory,
  Role,
} from '../common/enums/index.js';

describe('BehaviorService', () => {
  let service: BehaviorService;

  const mockTeacher = {
    id: 'teacher-uuid-1',
    userId: 'user-teacher-1',
    fullName: 'Mr. Emmanuel Adeyemi',
    schoolName: 'Afrotech Academy',
    assignedGrade: 'Grade 5',
    roomNumber: 'Room 201',
  };

  const mockStudent = {
    id: 'student-uuid-1',
    userId: 'user-student-1',
    studentCode: '06201',
    firstName: 'Divine',
    lastName: 'Ekubor',
    grade: 'Grade 5',
    room: 'Room 201',
    primaryTeacherId: 'teacher-uuid-1',
  };

  const mockAcademicSession = {
    id: 'session-uuid-1',
    sessionYear: '2026/2027',
    termName: 'First Term',
    isCurrent: true,
  };

  const mockBehaviorRecord = {
    id: 'behavior-uuid-1',
    studentId: 'student-uuid-1',
    teacherId: 'teacher-uuid-1',
    academicSessionId: 'session-uuid-1',
    category: BehaviorCategory.TEAMWORK,
    score: 88,
    remarks: 'Active participant in group science lab activities.',
    evaluationDate: new Date('2026-09-29'),
    createdAt: new Date(),
    updatedAt: new Date(),
    student: mockStudent,
    teacher: mockTeacher,
    academicSession: mockAcademicSession,
  };

  const mockPrisma = {
    teacherProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    academicSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    behaviorRecord: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    studentParentLink: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BehaviorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<BehaviorService>(BehaviorService);
  });

  describe('evaluateBehavior', () => {
    const dto = {
      studentId: 'student-uuid-1',
      academicSessionId: 'session-uuid-1',
      category: BehaviorCategory.TEAMWORK,
      score: 88,
      remarks: 'Active participant in group science lab activities.',
      evaluationDate: '2026-09-29',
    };

    it('evaluates student behavior successfully when teacher has student in homeroom', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.academicSession.findUnique.mockResolvedValue(
        mockAcademicSession,
      );
      mockPrisma.behaviorRecord.upsert.mockResolvedValue(mockBehaviorRecord);

      const result = await service.evaluateBehavior(
        mockTeacher.userId,
        Role.TEACHER,
        dto,
      );

      expect(result.message).toBe('Behavior evaluation recorded successfully');
      expect(result.rating).toBe('GOOD');
      expect(result.ratingLabel).toBe('Commendable');
      expect(mockPrisma.behaviorRecord.upsert).toHaveBeenCalled();
    });

    it('allows ADMIN to evaluate behavior even if not the homeroom teacher', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);
      mockPrisma.teacherProfile.findFirst.mockResolvedValue(mockTeacher);
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.academicSession.findUnique.mockResolvedValue(
        mockAcademicSession,
      );
      mockPrisma.behaviorRecord.upsert.mockResolvedValue(mockBehaviorRecord);

      const result = await service.evaluateBehavior(
        'admin-user-id',
        Role.ADMIN,
        dto,
      );

      expect(result.message).toBe('Behavior evaluation recorded successfully');
      expect(mockPrisma.behaviorRecord.upsert).toHaveBeenCalled();
    });

    it('throws NotFoundException if teacher profile does not exist for teacher role', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.evaluateBehavior('unknown-teacher', Role.TEACHER, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if student does not exist', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.student.findUnique.mockResolvedValue(null);

      await expect(
        service.evaluateBehavior(mockTeacher.userId, Role.TEACHER, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if student is not in teacher assigned class', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.student.findUnique.mockResolvedValue({
        ...mockStudent,
        primaryTeacherId: 'other-teacher-uuid',
        grade: 'Grade 1',
      });

      await expect(
        service.evaluateBehavior(mockTeacher.userId, Role.TEACHER, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if academic session does not exist', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.academicSession.findUnique.mockResolvedValue(null);

      await expect(
        service.evaluateBehavior(mockTeacher.userId, Role.TEACHER, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStudentBehavior', () => {
    it('throws NotFoundException if student does not exist', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(null);

      await expect(
        service.getStudentBehavior(
          {
            id: 'user-admin',
            role: Role.ADMIN,
            email: 'admin@school.com',
            accountStatus: AccountStatus.ACTIVE,
          },
          'non-existent',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if student tries to view someone else record', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);

      await expect(
        service.getStudentBehavior(
          {
            id: 'other-student-user',
            role: Role.STUDENT,
            email: 'other@school.com',
            accountStatus: AccountStatus.ACTIVE,
          },
          mockStudent.id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows student to view their own behavior records', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.academicSession.findFirst.mockResolvedValue(
        mockAcademicSession,
      );
      mockPrisma.behaviorRecord.findMany.mockResolvedValue([
        {
          ...mockBehaviorRecord,
          category: BehaviorCategory.TEAMWORK,
          score: 90,
        },
        {
          ...mockBehaviorRecord,
          category: BehaviorCategory.COMMUNICATION,
          score: 85,
        },
        {
          ...mockBehaviorRecord,
          category: BehaviorCategory.RESPECT,
          score: 95,
        },
        {
          ...mockBehaviorRecord,
          category: BehaviorCategory.RESPONSIBILITY,
          score: 90,
        },
      ]);

      const result = await service.getStudentBehavior(
        {
          id: mockStudent.userId,
          role: Role.STUDENT,
          email: 'student@school.com',
          accountStatus: AccountStatus.ACTIVE,
        },
        mockStudent.id,
      );

      expect(result.student.id).toBe(mockStudent.id);
      expect(result.overallAverageScore).toBe(90);
      expect(result.overallRating).toBe('EXCELLENT');
      expect(result.badges).toContain('Team Player');
      expect(result.badges).toContain('Clear Communicator');
      expect(result.badges).toContain('Respect Ambassador');
      expect(result.badges).toContain('Responsible Citizen');
      expect(result.badges).toContain('Exemplary Conduct');
      expect(result.badges).toContain('All-Round Role Model');
    });

    it('allows linked parent to view their child behavior records', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.studentParentLink.findUnique.mockResolvedValue({
        studentId: mockStudent.id,
        parentUserId: 'parent-user-id',
      });
      mockPrisma.academicSession.findFirst.mockResolvedValue(
        mockAcademicSession,
      );
      mockPrisma.behaviorRecord.findMany.mockResolvedValue([
        mockBehaviorRecord,
      ]);

      const result = await service.getStudentBehavior(
        {
          id: 'parent-user-id',
          role: Role.PARENT,
          email: 'parent@home.com',
          accountStatus: AccountStatus.ACTIVE,
        },
        mockStudent.id,
      );

      expect(result.student.id).toBe(mockStudent.id);
      expect(result.records).toHaveLength(1);
    });

    it('throws ForbiddenException if parent is not linked to the student', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.studentParentLink.findUnique.mockResolvedValue(null);

      await expect(
        service.getStudentBehavior(
          {
            id: 'unlinked-parent',
            role: Role.PARENT,
            email: 'parent@home.com',
            accountStatus: AccountStatus.ACTIVE,
          },
          mockStudent.id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows teacher to view their classroom student behavior records', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.academicSession.findFirst.mockResolvedValue(
        mockAcademicSession,
      );
      mockPrisma.behaviorRecord.findMany.mockResolvedValue([
        mockBehaviorRecord,
      ]);

      const result = await service.getStudentBehavior(
        {
          id: mockTeacher.userId,
          role: Role.TEACHER,
          email: 'teacher@school.com',
          accountStatus: AccountStatus.ACTIVE,
        },
        mockStudent.id,
      );

      expect(result.student.id).toBe(mockStudent.id);
      expect(result.records).toHaveLength(1);
    });

    it('throws ForbiddenException if teacher is not assigned to the student', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({
        ...mockStudent,
        primaryTeacherId: 'different-teacher',
        grade: 'Grade 2',
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);

      await expect(
        service.getStudentBehavior(
          {
            id: mockTeacher.userId,
            role: Role.TEACHER,
            email: 'teacher@school.com',
            accountStatus: AccountStatus.ACTIVE,
          },
          mockStudent.id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getClassroomBehavior', () => {
    it('returns classroom matrix and class averages for teacher', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.student.findMany.mockResolvedValue([mockStudent]);
      mockPrisma.academicSession.findFirst.mockResolvedValue(
        mockAcademicSession,
      );
      mockPrisma.behaviorRecord.findMany.mockResolvedValue([
        mockBehaviorRecord,
      ]);

      const result = await service.getClassroomBehavior({
        id: mockTeacher.userId,
        role: Role.TEACHER,
        email: 'teacher@school.com',
        accountStatus: AccountStatus.ACTIVE,
      });

      expect(result.classSummary.totalStudents).toBe(1);
      expect(result.classSummary.evaluatedStudents).toBe(1);
      expect(result.classSummary.classAverageScore).toBe(88);
      expect(result.students).toHaveLength(1);
      expect(result.students[0].scores[BehaviorCategory.TEAMWORK]).toBe(88);
    });

    it('allows ADMIN to retrieve classroom behavior with filters', async () => {
      mockPrisma.student.findMany.mockResolvedValue([mockStudent]);
      mockPrisma.academicSession.findUnique.mockResolvedValue(
        mockAcademicSession,
      );
      mockPrisma.behaviorRecord.findMany.mockResolvedValue([]);

      const result = await service.getClassroomBehavior(
        {
          id: 'admin-user',
          role: Role.ADMIN,
          email: 'admin@school.com',
          accountStatus: AccountStatus.ACTIVE,
        },
        { academicSessionId: mockAcademicSession.id, gradeLevel: 'Grade 5' },
      );

      expect(result.classSummary.totalStudents).toBe(1);
      expect(result.classSummary.evaluatedStudents).toBe(0);
      expect(result.students[0].averageScore).toBeNull();
    });
  });

  describe('updateBehavior', () => {
    it('updates score and remarks successfully by record owner teacher', async () => {
      mockPrisma.behaviorRecord.findUnique.mockResolvedValue(
        mockBehaviorRecord,
      );
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.behaviorRecord.update.mockResolvedValue({
        ...mockBehaviorRecord,
        score: 95,
        remarks: 'Exemplary leadership demonstrated.',
      });

      const result = await service.updateBehavior(
        mockTeacher.userId,
        mockBehaviorRecord.id,
        { score: 95, remarks: 'Exemplary leadership demonstrated.' },
      );

      expect(result.message).toBe('Behavior record updated successfully');
      expect(result.rating).toBe('EXCELLENT');
      expect(mockPrisma.behaviorRecord.update).toHaveBeenCalled();
    });

    it('throws NotFoundException if record does not exist', async () => {
      mockPrisma.behaviorRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.updateBehavior(mockTeacher.userId, 'non-existent', {
          score: 90,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if teacher is not the record creator', async () => {
      mockPrisma.behaviorRecord.findUnique.mockResolvedValue(
        mockBehaviorRecord,
      );
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        ...mockTeacher,
        id: 'other-teacher-id',
      });

      await expect(
        service.updateBehavior('other-teacher-user', mockBehaviorRecord.id, {
          score: 90,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteBehavior', () => {
    it('deletes behavior record successfully by creator teacher', async () => {
      mockPrisma.behaviorRecord.findUnique.mockResolvedValue(
        mockBehaviorRecord,
      );
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.behaviorRecord.delete.mockResolvedValue(mockBehaviorRecord);

      const result = await service.deleteBehavior(
        mockTeacher.userId,
        mockBehaviorRecord.id,
      );

      expect(result.message).toBe('Behavior record deleted successfully');
      expect(mockPrisma.behaviorRecord.delete).toHaveBeenCalledWith({
        where: { id: mockBehaviorRecord.id },
      });
    });

    it('throws NotFoundException when trying to delete non-existent record', async () => {
      mockPrisma.behaviorRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteBehavior(mockTeacher.userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows ADMIN to delete any behavior record', async () => {
      mockPrisma.behaviorRecord.findUnique.mockResolvedValue(
        mockBehaviorRecord,
      );
      mockPrisma.behaviorRecord.delete.mockResolvedValue(mockBehaviorRecord);

      const result = await service.deleteBehavior(
        'admin-user',
        mockBehaviorRecord.id,
        true,
      );

      expect(result.message).toBe('Behavior record deleted successfully');
      expect(mockPrisma.behaviorRecord.delete).toHaveBeenCalledWith({
        where: { id: mockBehaviorRecord.id },
      });
    });
  });
});
