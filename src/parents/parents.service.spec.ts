import { Test, TestingModule } from '@nestjs/testing';
import { ParentsService } from './parents.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ParentsService', () => {
  let service: ParentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        {
          provide: PrismaService,
          useValue: {
            student: { findUnique: jest.fn() },
            studentParentLink: {
              findUnique: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ParentsService>(ParentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw NotFoundException if studentCode does not exist', async () => {
    jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(null);

    await expect(
      service.linkStudent('parent-uuid', { studentCode: 'INVALID' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if child is already linked to parent', async () => {
    jest.spyOn(prisma.student, 'findUnique').mockResolvedValue({
      id: 'student-uuid-1',
      studentCode: '06201',
    } as any);

    jest.spyOn(prisma.studentParentLink, 'findUnique').mockResolvedValue({
      id: 'link-1',
      studentId: 'student-uuid-1',
      parentUserId: 'parent-uuid',
    } as any);

    await expect(
      service.linkStudent('parent-uuid', { studentCode: '06201' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should link student and return student parent link with details', async () => {
    jest.spyOn(prisma.student, 'findUnique').mockResolvedValue({
      id: 'student-uuid-1',
      studentCode: '06201',
    } as any);

    jest.spyOn(prisma.studentParentLink, 'findUnique').mockResolvedValue(null);

    const mockCreatedLink = {
      id: 'link-1',
      studentId: 'student-uuid-1',
      parentUserId: 'parent-uuid',
      relationshipType: 'Mother',
      isPrimaryContact: true,
      linkedAt: new Date(),
      student: {
        id: 'student-uuid-1',
        studentCode: '06201',
        firstName: 'Divine',
        lastName: 'Ekubor',
        grade: 'Grade 5',
        room: 'Room 201',
        avatarUrl: null,
        primaryTeacher: {
          fullName: 'Miss Edith Robinson',
          schoolName: 'Afrotech Academy',
        },
      },
    };

    jest
      .spyOn(prisma.studentParentLink, 'create')
      .mockResolvedValue(mockCreatedLink as any);

    const result = await service.linkStudent('parent-uuid', {
      studentCode: '06201',
      relationshipType: 'Mother',
      isPrimaryContact: true,
    });

    expect(result.id).toBe('link-1');
    expect(result.student.studentCode).toBe('06201');
    expect(prisma.studentParentLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-uuid-1',
          parentUserId: 'parent-uuid',
          relationshipType: 'Mother',
          isPrimaryContact: true,
        }),
      }),
    );
  });

  it('should get linked students list for a parent', async () => {
    const mockLinks = [
      {
        id: 'link-1',
        relationshipType: 'Mother',
        isPrimaryContact: true,
        student: {
          id: 'student-1',
          studentCode: '06201',
          firstName: 'Divine',
          lastName: 'Ekubor',
          grade: 'Grade 5',
          room: 'Room 201',
          avatarUrl: null,
          primaryTeacher: {
            fullName: 'Miss Edith Robinson',
            schoolName: 'Afrotech Academy',
          },
        },
      },
    ];

    jest
      .spyOn(prisma.studentParentLink, 'findMany')
      .mockResolvedValue(mockLinks as any);

    const result = await service.getLinkedStudents('parent-uuid');
    expect(result.length).toBe(1);
    expect(result[0].student.studentCode).toBe('06201');
    expect(result[0].student.fullName).toBe('Divine Ekubor');
  });
});
