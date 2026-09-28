import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HomeworkService } from './homework.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { HomeworkStatus, SubmissionStatus } from '../common/enums/index.js';

describe('HomeworkService', () => {
  let service: HomeworkService;

  const mockTeacher = {
    id: 'teacher-uuid-1',
    userId: 'user-teacher-1',
    fullName: 'Miss Edith Robinson',
    schoolName: 'Afrotech Academy',
  };

  const mockSubject = {
    id: 'subject-uuid-1',
    name: 'Mathematics',
    code: 'MATH',
  };

  const mockStudent = {
    id: 'student-uuid-1',
    userId: 'user-student-1',
    studentCode: '06201',
    firstName: 'Divine',
    lastName: 'Ekubor',
    grade: 'Grade 5',
    room: 'Room 201',
  };

  const mockHomework = {
    id: 'homework-uuid-1',
    teacherId: 'teacher-uuid-1',
    subjectId: 'subject-uuid-1',
    gradeLevel: 'Grade 5',
    room: 'Room 201',
    title: 'Fractions & Decimals Practice',
    instructions: 'Complete exercises 1 to 15.',
    dueDate: new Date('2026-10-05'),
    status: HomeworkStatus.PUBLISHED,
    attachmentUrls: ['https://storage.connected.edu/worksheets/fractions.pdf'],
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: mockSubject,
    teacher: mockTeacher,
    submissions: [],
  };

  const mockPrisma = {
    teacherProfile: {
      findUnique: jest.fn(),
    },
    subject: {
      findUnique: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
    },
    homework: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    homeworkSubmission: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    studentParentLink: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeworkService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<HomeworkService>(HomeworkService);
  });

  describe('createHomework', () => {
    it('creates homework when teacher and subject exist', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.subject.findUnique.mockResolvedValue(mockSubject);
      mockPrisma.homework.create.mockResolvedValue(mockHomework);

      const dto = {
        subjectId: mockSubject.id,
        gradeLevel: 'Grade 5',
        room: 'Room 201',
        title: 'Fractions & Decimals Practice',
        instructions: 'Complete exercises 1 to 15.',
        dueDate: '2026-10-05',
        attachmentUrls: [
          'https://storage.connected.edu/worksheets/fractions.pdf',
        ],
      };

      const result = await service.createHomework('user-teacher-1', dto);

      expect(result).toEqual(mockHomework);
      expect(mockPrisma.homework.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teacherId: mockTeacher.id,
          subjectId: mockSubject.id,
          title: dto.title,
        }),
        include: expect.any(Object),
      });
    });

    it('throws ForbiddenException if teacher profile does not exist', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createHomework('non-teacher-user', {
          subjectId: 'sub-1',
          gradeLevel: 'Grade 5',
          title: 'Test',
          instructions: 'Test',
          dueDate: '2026-10-05',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if subject does not exist', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.subject.findUnique.mockResolvedValue(null);

      await expect(
        service.createHomework('user-teacher-1', {
          subjectId: 'missing-sub',
          gradeLevel: 'Grade 5',
          title: 'Test',
          instructions: 'Test',
          dueDate: '2026-10-05',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTeacherHomework', () => {
    it('returns homework list for authenticated teacher', async () => {
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.homework.findMany.mockResolvedValue([mockHomework]);

      const result = await service.getTeacherHomework('user-teacher-1');

      expect(result).toEqual([mockHomework]);
      expect(mockPrisma.homework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teacherId: mockTeacher.id }),
        }),
      );
    });

    it('allows admin to list homework without teacher profile check', async () => {
      mockPrisma.homework.findMany.mockResolvedValue([mockHomework]);

      const result = await service.getTeacherHomework(
        'admin-user',
        undefined,
        true,
      );

      expect(result).toEqual([mockHomework]);
      expect(mockPrisma.teacherProfile.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getHomeworkById', () => {
    it('returns homework with submission stats', async () => {
      const hwWithSubmissions = {
        ...mockHomework,
        submissions: [
          { status: SubmissionStatus.SUBMITTED, parentSignatureVerified: true },
          { status: SubmissionStatus.REVIEWED, parentSignatureVerified: false },
          { status: SubmissionStatus.PENDING, parentSignatureVerified: false },
        ],
      };
      mockPrisma.homework.findUnique.mockResolvedValue(hwWithSubmissions);

      const result = await service.getHomeworkById('homework-uuid-1');

      expect(result.id).toBe('homework-uuid-1');
      expect(result.stats).toEqual({
        totalSubmissions: 3,
        submittedCount: 2,
        reviewedCount: 1,
        parentSignedCount: 1,
      });
    });

    it('throws NotFoundException if homework does not exist', async () => {
      mockPrisma.homework.findUnique.mockResolvedValue(null);

      await expect(service.getHomeworkById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateHomework', () => {
    it('updates homework successfully when teacher owns it', async () => {
      mockPrisma.homework.findUnique.mockResolvedValue(mockHomework);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.homework.update.mockResolvedValue({
        ...mockHomework,
        title: 'Updated Title',
      });

      const result = await service.updateHomework(
        'homework-uuid-1',
        'user-teacher-1',
        { title: 'Updated Title' },
      );

      expect(result.title).toBe('Updated Title');
    });

    it('throws ForbiddenException if different teacher attempts to update', async () => {
      mockPrisma.homework.findUnique.mockResolvedValue(mockHomework);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'other-teacher',
        userId: 'other-user',
      });

      await expect(
        service.updateHomework('homework-uuid-1', 'other-user', {
          title: 'Hacked Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteHomework', () => {
    it('deletes homework successfully', async () => {
      mockPrisma.homework.findUnique.mockResolvedValue(mockHomework);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.homework.delete.mockResolvedValue(mockHomework);

      const result = await service.deleteHomework(
        'homework-uuid-1',
        'user-teacher-1',
      );

      expect(result).toEqual({
        message: 'Homework assignment deleted successfully',
      });
      expect(mockPrisma.homework.delete).toHaveBeenCalledWith({
        where: { id: 'homework-uuid-1' },
      });
    });
  });

  describe('getStudentHomework', () => {
    it('returns published homework with student personal submission status', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      const hwWithSub = {
        ...mockHomework,
        submissions: [
          {
            id: 'sub-1',
            status: SubmissionStatus.SUBMITTED,
            completedAt: new Date(),
            submissionNotes: 'All done',
            attachmentUrls: [],
            parentSignatureVerified: true,
            parentSignedAt: new Date(),
          },
        ],
      };
      mockPrisma.homework.findMany.mockResolvedValue([hwWithSub]);

      const result = await service.getStudentHomework('user-student-1');

      expect(result).toHaveLength(1);
      expect(result[0].submission.status).toBe(SubmissionStatus.SUBMITTED);
      expect(result[0].submission.parentSignatureVerified).toBe(true);
    });

    it('throws NotFoundException if student profile does not exist', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(null);

      await expect(
        service.getStudentHomework('unknown-student'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitHomework', () => {
    it('upserts student submission as SUBMITTED', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.homework.findUnique.mockResolvedValue(mockHomework);
      const mockSubmission = {
        id: 'sub-1',
        homeworkId: 'homework-uuid-1',
        studentId: mockStudent.id,
        status: SubmissionStatus.SUBMITTED,
        completedAt: new Date(),
        submissionNotes: 'Finished exercises',
      };
      mockPrisma.homeworkSubmission.upsert.mockResolvedValue(mockSubmission);

      const result = await service.submitHomework(
        'homework-uuid-1',
        'user-student-1',
        { submissionNotes: 'Finished exercises' },
      );

      expect(result.status).toBe(SubmissionStatus.SUBMITTED);
      expect(mockPrisma.homeworkSubmission.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            homeworkId_studentId: {
              homeworkId: 'homework-uuid-1',
              studentId: mockStudent.id,
            },
          },
        }),
      );
    });
  });

  describe('parentSignHomework', () => {
    it('signs completed homework successfully when parent is linked', async () => {
      mockPrisma.studentParentLink.findUnique.mockResolvedValue({
        id: 'link-1',
        studentId: mockStudent.id,
        parentUserId: 'parent-user-1',
      });
      mockPrisma.homeworkSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.SUBMITTED,
      });
      mockPrisma.homeworkSubmission.update.mockResolvedValue({
        id: 'sub-1',
        parentSignatureVerified: true,
      });

      const result = await service.parentSignHomework(
        'homework-uuid-1',
        mockStudent.id,
        'parent-user-1',
      );

      expect(result.parentSignatureVerified).toBe(true);
    });

    it('throws ForbiddenException if parent is not linked to student', async () => {
      mockPrisma.studentParentLink.findUnique.mockResolvedValue(null);

      await expect(
        service.parentSignHomework(
          'homework-uuid-1',
          'other-student',
          'parent-user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if homework has not been submitted yet', async () => {
      mockPrisma.studentParentLink.findUnique.mockResolvedValue({
        id: 'link-1',
      });
      mockPrisma.homeworkSubmission.findUnique.mockResolvedValue(null);

      await expect(
        service.parentSignHomework(
          'homework-uuid-1',
          mockStudent.id,
          'parent-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewSubmission', () => {
    it('marks submission as reviewed', async () => {
      mockPrisma.homework.findUnique.mockResolvedValue(mockHomework);
      mockPrisma.teacherProfile.findUnique.mockResolvedValue(mockTeacher);
      mockPrisma.homeworkSubmission.findUnique.mockResolvedValue({
        id: 'sub-1',
      });
      mockPrisma.homeworkSubmission.update.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.REVIEWED,
      });

      const result = await service.reviewSubmission(
        'homework-uuid-1',
        mockStudent.id,
        'user-teacher-1',
        { status: SubmissionStatus.REVIEWED },
      );

      expect(result.status).toBe(SubmissionStatus.REVIEWED);
    });
  });
});
