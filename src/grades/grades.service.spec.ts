import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GradesService } from './grades.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { AssessmentType, Role } from '../common/enums/index.js';

describe('GradesService', () => {
  let service: GradesService;
  let prisma: PrismaService;

  const mockTeacherProfile = {
    id: 'teacher-profile-uuid-1',
    userId: 'teacher-user-uuid-1',
    fullName: 'Mr. David Okafor',
  };

  const mockStudent = {
    id: 'student-uuid-1',
    firstName: 'Divine',
    lastName: 'Ekubor',
    studentCode: '06201',
    grade: 'Grade 5',
    room: 'Room 201',
    primaryTeacherId: 'teacher-profile-uuid-1',
    userId: 'student-user-uuid-1',
  };

  const mockOtherStudent = {
    id: 'student-uuid-2',
    firstName: 'Aisha',
    lastName: 'Bello',
    studentCode: '06202',
    primaryTeacherId: 'other-teacher-uuid',
    userId: 'student-user-uuid-2',
  };

  const mockSubject = {
    id: 'subject-uuid-1',
    name: 'Mathematics',
    code: 'MATH-101',
  };

  const mockSession = {
    id: 'session-uuid-1',
    sessionYear: '2024/2025',
    termName: 'Term 1',
    isCurrent: true,
    startDate: new Date('2024-09-01'),
    endDate: new Date('2024-12-15'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
        {
          provide: PrismaService,
          useValue: {
            teacherProfile: {
              findUnique: jest.fn(),
            },
            student: {
              findUnique: jest.fn(),
            },
            subject: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
            },
            academicSession: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
            },
            studentParentLink: {
              findUnique: jest.fn(),
            },
            gradeAssessment: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<GradesService>(GradesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordAssessment', () => {
    const validDto = {
      studentId: mockStudent.id,
      subjectId: mockSubject.id,
      academicSessionId: mockSession.id,
      assessmentType: AssessmentType.TEST,
      assessmentTitle: 'Continuous Assessment 1',
      score: 85,
      totalPossibleMarks: 100,
      evaluationDate: '2026-09-26',
      notes: 'Good performance',
    };

    it('should throw NotFoundException if teacher profile does not exist', async () => {
      jest.spyOn(prisma.teacherProfile, 'findUnique').mockResolvedValue(null);

      await expect(
        service.recordAssessment('non-existent-user', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if student does not belong to teacher class', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockOtherStudent as any);

      await expect(
        service.recordAssessment(mockTeacherProfile.userId, validDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if subject does not exist', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);
      jest.spyOn(prisma.subject, 'findUnique').mockResolvedValue(null);

      await expect(
        service.recordAssessment(mockTeacherProfile.userId, validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate letter grade and create assessment record successfully', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);
      jest
        .spyOn(prisma.subject, 'findUnique')
        .mockResolvedValue(mockSubject as any);
      jest
        .spyOn(prisma.academicSession, 'findUnique')
        .mockResolvedValue(mockSession as any);

      const mockSaved = {
        id: 'grade-uuid-1',
        ...validDto,
        gradeLetter: 'A',
        teacherId: mockTeacherProfile.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest
        .spyOn(prisma.gradeAssessment, 'create')
        .mockResolvedValue(mockSaved as any);

      const result = await service.recordAssessment(
        mockTeacherProfile.userId,
        validDto,
      );

      expect(result).toBeDefined();
      expect(result.gradeLetter).toBe('A');
      expect(result.percentage).toBe(85);
      expect(prisma.gradeAssessment.create).toHaveBeenCalled();
    });
  });

  describe('getClassGrades', () => {
    it('should throw NotFoundException if teacher profile does not exist', async () => {
      jest.spyOn(prisma.teacherProfile, 'findUnique').mockResolvedValue(null);

      await expect(service.getClassGrades('non-existent-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return classroom grades with statistical summary', async () => {
      jest
        .spyOn(prisma.teacherProfile, 'findUnique')
        .mockResolvedValue(mockTeacherProfile as any);

      const mockAssessments = [
        {
          id: 'g-1',
          score: 80,
          totalPossibleMarks: 100,
          student: mockStudent,
          subject: mockSubject,
        },
        {
          id: 'g-2',
          score: 90,
          totalPossibleMarks: 100,
          student: mockStudent,
          subject: mockSubject,
        },
      ];
      jest
        .spyOn(prisma.gradeAssessment, 'findMany')
        .mockResolvedValue(mockAssessments as any);

      const result = await service.getClassGrades(mockTeacherProfile.userId);

      expect(result).toBeDefined();
      expect(result.summary.totalRecords).toBe(2);
      expect(result.summary.averageScore).toBe(85);
      expect(result.summary.highestScore).toBe(90);
      expect(result.summary.lowestScore).toBe(80);
    });
  });

  describe('getStudentReportCard (RBAC & Badges)', () => {
    it('should throw NotFoundException if student not found', async () => {
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getStudentReportCard(
          { id: 'admin-id', role: Role.ADMIN } as any,
          'non-existent-student',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow Student to view their own report card', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);
      jest
        .spyOn(prisma.academicSession, 'findFirst')
        .mockResolvedValue(mockSession as any);
      jest.spyOn(prisma.gradeAssessment, 'findMany').mockResolvedValue([]);

      const result = await service.getStudentReportCard(
        { id: mockStudent.userId, role: Role.STUDENT } as any,
        mockStudent.id,
      );

      expect(result).toBeDefined();
      expect(result.student.id).toBe(mockStudent.id);
    });

    it('should forbid Student from viewing another student report card', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockOtherStudent as any);

      await expect(
        service.getStudentReportCard(
          { id: mockStudent.userId, role: Role.STUDENT } as any,
          mockOtherStudent.id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Parent to view linked child report card', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);
      jest
        .spyOn(prisma.studentParentLink, 'findUnique')
        .mockResolvedValue({ id: 'link-1' } as any);
      jest
        .spyOn(prisma.academicSession, 'findFirst')
        .mockResolvedValue(mockSession as any);
      jest.spyOn(prisma.gradeAssessment, 'findMany').mockResolvedValue([]);

      const result = await service.getStudentReportCard(
        { id: 'parent-user-1', role: Role.PARENT } as any,
        mockStudent.id,
      );

      expect(result).toBeDefined();
    });

    it('should forbid Parent from viewing unlinked student report card', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);
      jest
        .spyOn(prisma.studentParentLink, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.getStudentReportCard(
          { id: 'parent-user-1', role: Role.PARENT } as any,
          mockStudent.id,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should correctly calculate Continuous Assessment vs Exam splits and badges', async () => {
      jest
        .spyOn(prisma.student, 'findUnique')
        .mockResolvedValue(mockStudent as any);
      jest
        .spyOn(prisma.academicSession, 'findFirst')
        .mockResolvedValue(mockSession as any);

      const mockGrades = [
        {
          id: 'g-1',
          subjectId: mockSubject.id,
          assessmentType: AssessmentType.TEST,
          assessmentTitle: 'Continuous Assessment 1',
          score: 85,
          totalPossibleMarks: 100,
          gradeLetter: 'A',
          subject: mockSubject,
        },
        {
          id: 'g-2',
          subjectId: mockSubject.id,
          assessmentType: AssessmentType.EXAM,
          assessmentTitle: 'Final Exam',
          score: 95,
          totalPossibleMarks: 100,
          gradeLetter: 'A+',
          subject: mockSubject,
        },
      ];
      jest
        .spyOn(prisma.gradeAssessment, 'findMany')
        .mockResolvedValue(mockGrades as any);

      const result = await service.getStudentReportCard(
        { id: 'admin-id', role: Role.ADMIN } as any,
        mockStudent.id,
        mockSession.id,
      );

      expect(result).toBeDefined();
      expect(result.subjects).toHaveLength(1);
      const mathReport = result.subjects[0];
      expect(mathReport.subjectName).toBe('Mathematics');
      expect(mathReport.continuousAssessmentAverage).toBe(85);
      expect(mathReport.examAverage).toBe(95);
      expect(mathReport.overallAverage).toBe(90);
      expect(mathReport.gradeLetter).toBe('A+');
      expect(result.badges).toContain('Honor Roll');
      expect(result.badges).toContain('Math Whiz');
    });
  });
});
