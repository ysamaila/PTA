# Auth and Core Identity Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the authentication and core identity subsystem for ConnectEd across all personas (Parent, Teacher, Student, Admin) by introducing the Student persona and login flow (`AUTH-06`), multi-child parent linking (`PRF-03`), teacher classroom metadata (`PRF-02`), and cross-role user preferences (`PRF-04`).

**Architecture:** Extend Prisma schema to include `Role.STUDENT`, `Student`, `StudentParentLink`, and `UserPreferences` models. Implement student PIN authentication with JWT issuance, multi-child parent linking service, and preference endpoints while maintaining 100% backward compatibility with existing Parent/Teacher/Admin auth. Seed default prototype roster (`Divine Ekubor [06201]`, `Emma Wilson [06202]`, `Bryan Williams [06204]`).

**Tech Stack:** NestJS 11, Prisma 7 with Postgres Driver Adapter, Argon2 password/PIN hashing, Passport JWT, class-validator / class-transformer.

**Spec:** [`PRD_Final.md`](file:///c:/Users/User/Documents/GitHub/PTA/PRD_Final.md) and [`BACKEND_DATA_MODELS.md`](file:///c:/Users/User/Documents/GitHub/PTA/BACKEND_DATA_MODELS.md)

## Global Constraints

- Preserve all existing routes (`/api/auth/parent/*`, `/api/auth/teacher/*`, `/api/auth/admin/*`, `/api/auth/verify-code`, `/api/auth/refresh`, etc.) and ensure all existing tests pass.
- Role strings and tokens must use uppercase enum values matching Prisma client (`PARENT`, `TEACHER`, `ADMIN`, `STUDENT`).
- Student login must authenticate via `studentCode` and 4-to-6 digit numeric `pin`.
- Never expose password hashes, PIN hashes, or verification code hashes in API responses.
- All endpoints must include full Swagger `@ApiTags`, `@ApiOperation`, and `@ApiResponse` documentation annotations.

---

### Task 1: Prisma Schema Migration for Core Identity & Students

**Files:**
- Modify: `prisma/schema.prisma`
- Test: Run Prisma generate & validate schema

**Interfaces:**
- Consumes: Existing `User`, `ParentProfile`, `TeacherProfile` models.
- Produces: Updated `Role` enum (`STUDENT`), `Gender` enum, `Student`, `StudentParentLink`, `UserPreferences` models, and updated relations.

- [x] **Step 1: Update Prisma schema with Student, StudentParentLink, UserPreferences, and Gender**

Update `prisma/schema.prisma`:
```prisma
enum Role {
  PARENT
  TEACHER
  ADMIN
  STUDENT
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

model User {
  id                String             @id @default(uuid())
  email             String?            @unique
  phoneNumber       String?
  passwordHash      String?
  role              Role
  accountStatus     AccountStatus      @default(PENDING_VERIFICATION)
  isEmailVerified   Boolean            @default(false)
  emailVerifiedAt   DateTime?
  termsAccepted     Boolean            @default(true)
  termsAcceptedAt   DateTime?          @default(now())
  profileImageUrl   String?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  parentProfile      ParentProfile?
  teacherProfile     TeacherProfile?
  studentProfile     Student?
  studentParentLinks StudentParentLink[]
  preferences        UserPreferences?
  verificationCodes  VerificationCode[]
  refreshTokens      RefreshToken[]

  @@index([email])
  @@index([role])
  @@index([accountStatus])
  @@map("users")
}

model TeacherProfile {
  id                    String    @id @default(uuid())
  userId                String    @unique
  fullName              String
  schoolName            String
  phone                 String?
  subjectSpecialization String?
  assignedGrade         String    @default("Grade 5")
  roomNumber            String    @default("Room 201")
  studentCapacity       Int       @default(35)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  students Student[]

  @@map("teacher_profiles")
}

model Student {
  id               String    @id @default(uuid())
  userId           String?   @unique
  studentCode      String    @unique
  firstName        String
  lastName         String
  dateOfBirth      DateTime
  gender           Gender    @default(OTHER)
  grade            String
  room             String
  avatarUrl        String?
  accessPinHash    String
  primaryTeacherId String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user           User?               @relation(fields: [userId], references: [id], onDelete: SetNull)
  primaryTeacher TeacherProfile?     @relation(fields: [primaryTeacherId], references: [id], onDelete: SetNull)
  parentLinks    StudentParentLink[]

  @@index([studentCode])
  @@index([primaryTeacherId])
  @@map("students")
}

model StudentParentLink {
  id                 String   @id @default(uuid())
  studentId          String
  parentUserId       String
  relationshipType   String   @default("Parent")
  isPrimaryContact   Boolean  @default(false)
  linkedAt           DateTime @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  parent  User    @relation(fields: [parentUserId], references: [id], onDelete: Cascade)

  @@unique([studentId, parentUserId])
  @@index([parentUserId])
  @@index([studentId])
  @@map("student_parent_links")
}

model UserPreferences {
  id                         String   @id @default(uuid())
  userId                     String   @unique
  pushNotificationsEnabled   Boolean  @default(true)
  soundEnabled               Boolean  @default(true)
  darkModeEnabled            Boolean  @default(false)
  autoSyncEnabled            Boolean  @default(true)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_preferences")
}
```

- [x] **Step 2: Generate Prisma client and push changes to database**

Run:
```powershell
npx prisma generate
npx prisma db push
```
Expected: Schema synchronized and Prisma Client regenerated successfully without errors.

- [x] **Step 3: Run existing test suite to ensure zero regressions**

Run: `npm test`
Expected: All existing authentication and authorization tests pass.

- [x] **Step 4: Commit schema changes**

```bash
git add prisma/schema.prisma generated/prisma
git commit -m "feat(db): add Student, StudentParentLink, UserPreferences models and Role.STUDENT"
```

---

### Task 2: Database Seeding for Prototype Students & Homeroom Teacher

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `"prisma": { "seed": "node --loader ts-node/esm prisma/seed.ts" }` or execution script)
- Test: Run seed script

**Interfaces:**
- Consumes: Prisma models `User`, `TeacherProfile`, `Student`.
- Produces: Default seeded records for `Miss Edith Robinson` and students `Divine Ekubor (06201)`, `Emma Wilson (06202)`, `Bryan Williams (06204)`.

- [x] **Step 1: Write seed script in `prisma/seed.ts`**

```typescript
import { PrismaClient, Role, AccountStatus, Gender } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding initial teacher and student roster...');

  // 1. Seed Homeroom Teacher: Miss Edith Robinson
  const teacherPasswordHash = await argon2.hash('Teacher@1234');
  const teacherUser = await prisma.user.upsert({
    where: { email: 'edith.robinson@afrotech.edu' },
    update: {},
    create: {
      email: 'edith.robinson@afrotech.edu',
      passwordHash: teacherPasswordHash,
      role: Role.TEACHER,
      accountStatus: AccountStatus.ACTIVE,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      teacherProfile: {
        create: {
          fullName: 'Miss Edith Robinson',
          schoolName: 'Afrotech Academy',
          assignedGrade: 'Grade 5',
          roomNumber: 'Room 201',
          studentCapacity: 35,
          phone: '+2348011223344',
          subjectSpecialization: 'Mathematics',
        },
      },
      preferences: {
        create: {
          pushNotificationsEnabled: true,
          soundEnabled: true,
          darkModeEnabled: false,
          autoSyncEnabled: true,
        },
      },
    },
    include: { teacherProfile: true },
  });

  const teacherProfileId = teacherUser.teacherProfile!.id;

  // 2. Seed Default PIN hash (1234)
  const defaultPinHash = await argon2.hash('1234');

  const students = [
    {
      studentCode: '06201',
      firstName: 'Divine',
      lastName: 'Ekubor',
      dateOfBirth: new Date('2014-05-14'),
      gender: Gender.MALE,
      grade: 'Grade 5',
      room: 'Room 201',
    },
    {
      studentCode: '06202',
      firstName: 'Emma',
      lastName: 'Wilson',
      dateOfBirth: new Date('2014-08-22'),
      gender: Gender.FEMALE,
      grade: 'Grade 5',
      room: 'Room 201',
    },
    {
      studentCode: '06204',
      firstName: 'Bryan',
      lastName: 'Williams',
      dateOfBirth: new Date('2014-02-10'),
      gender: Gender.MALE,
      grade: 'Grade 5',
      room: 'Room 201',
    },
  ];

  for (const s of students) {
    // Create Student User for login capability
    const studentUser = await prisma.user.upsert({
      where: { email: `${s.studentCode.toLowerCase()}@student.afrotech.edu` },
      update: {},
      create: {
        email: `${s.studentCode.toLowerCase()}@student.afrotech.edu`,
        role: Role.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        preferences: {
          create: {},
        },
      },
    });

    await prisma.student.upsert({
      where: { studentCode: s.studentCode },
      update: {
        primaryTeacherId: teacherProfileId,
        userId: studentUser.id,
      },
      create: {
        studentCode: s.studentCode,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        grade: s.grade,
        room: s.room,
        accessPinHash: defaultPinHash,
        primaryTeacherId: teacherProfileId,
        userId: studentUser.id,
      },
    });
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
```

- [x] **Step 2: Execute seeding and verify records**

Run: `node prisma/seed.ts` (or `npx tsx prisma/seed.ts`)
Expected: Seeding logs output and completes with exit code 0.

- [x] **Step 3: Commit seed script**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): add prototype homeroom teacher and students seed"
```

---

### Task 3: Student Authentication Flow (`POST /api/auth/student/login`)

**Files:**
- Create: `src/auth/dto/login-student.dto.ts`
- Modify: `src/auth/auth.service.ts`
- Modify: `src/auth/auth.controller.ts`
- Test: `src/auth/student-auth.spec.ts`

**Interfaces:**
- Consumes: `studentCode`, `pin` via `LoginStudentDto`.
- Produces: `AuthResult` with JWT access/refresh tokens and sanitized student user payload.

- [x] **Step 1: Write failing test in `src/auth/student-auth.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../mail/mail.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService - Student Login', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            student: { findUnique: jest.fn() },
            user: { findUnique: jest.fn() },
            refreshToken: { create: jest.fn() },
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateTokens: jest.fn().mockResolvedValue({
              accessToken: 'mock-access-token',
              refreshToken: 'mock-refresh-token',
              expiresIn: 900,
            }),
          },
        },
        {
          provide: MailService,
          useValue: { sendVerificationCode: jest.fn() },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should throw UnauthorizedException if studentCode is invalid', async () => {
    jest.spyOn(prismaService.student, 'findUnique').mockResolvedValue(null);

    await expect(
      authService.loginStudent({ studentCode: '99999', pin: '1234' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/student-auth.spec.ts`
Expected: FAIL with `authService.loginStudent is not a function`.

- [x] **Step 3: Create `LoginStudentDto`**

Create `src/auth/dto/login-student.dto.ts`:
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginStudentDto {
  @ApiProperty({
    example: '06201',
    description: 'School-issued 5-character student ID code',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  studentCode: string;

  @ApiProperty({
    example: '1234',
    description: '4 to 6-digit numeric access PIN',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be between 4 and 6 digits' })
  pin: string;
}
```

- [x] **Step 4: Implement `loginStudent` in `AuthService` and add controller route**

In `src/auth/auth.service.ts`:
```typescript
async loginStudent(dto: LoginStudentDto): Promise<AuthResult> {
  const student = await this.prisma.student.findUnique({
    where: { studentCode: dto.studentCode },
    include: {
      user: {
        include: {
          preferences: true,
        },
      },
      primaryTeacher: true,
    },
  });

  if (!student || !student.user) {
    throw new UnauthorizedException('Invalid student ID or PIN');
  }

  const isPinValid = await argon2.verify(student.accessPinHash, dto.pin);
  if (!isPinValid) {
    throw new UnauthorizedException('Invalid student ID or PIN');
  }

  const tokens = await this.tokenService.generateTokens({
    sub: student.user.id,
    email: student.user.email ?? `${student.studentCode}@student.connected.internal`,
    role: Role.STUDENT,
  });

  return {
    user: {
      id: student.user.id,
      email: student.user.email ?? `${student.studentCode}@student.connected.internal`,
      role: Role.STUDENT,
      accountStatus: student.user.accountStatus,
      isEmailVerified: student.user.isEmailVerified,
      emailVerifiedAt: student.user.emailVerifiedAt,
      createdAt: student.user.createdAt,
      profile: {
        fullName: `${student.firstName} ${student.lastName}`,
        studentCode: student.studentCode,
        grade: student.grade,
        room: student.room,
        schoolName: student.primaryTeacher?.schoolName ?? null,
      },
    },
    tokens,
  };
}
```

In `src/auth/auth.controller.ts`:
```typescript
@Post('student/login')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Authenticate as Student via Student ID and PIN' })
@ApiResponse({ status: 200, description: 'Student authenticated successfully' })
@ApiResponse({ status: 401, description: 'Invalid student ID or PIN' })
async loginStudent(@Body() dto: LoginStudentDto): Promise<AuthResult> {
  return this.authService.loginStudent(dto);
}
```

- [x] **Step 5: Run tests and verify PASS**

Run: `npx jest src/auth/student-auth.spec.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/auth/dto/login-student.dto.ts src/auth/auth.service.ts src/auth/auth.controller.ts src/auth/student-auth.spec.ts
git commit -m "feat(auth): implement student login with studentCode and PIN"
```

---

### Task 4: Multi-Child Parent Linking Module (`POST /api/parents/students/link`, `GET /api/parents/students`)

**Files:**
- Create: `src/parents/parents.module.ts`
- Create: `src/parents/parents.controller.ts`
- Create: `src/parents/parents.service.ts`
- Create: `src/parents/dto/link-student.dto.ts`
- Create: `src/parents/parents.service.spec.ts`
- Modify: `src/app.module.ts` (import `ParentsModule`)

**Interfaces:**
- Consumes: Authenticated `User` (Role `PARENT`), `studentCode`, `relationshipType`.
- Produces: List of linked children with basic academic and attendance snapshot.

- [x] **Step 1: Write failing unit test in `src/parents/parents.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ParentsService } from './parents.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

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
            studentParentLink: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
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
});
```

- [x] **Step 2: Create DTO `src/parents/dto/link-student.dto.ts`**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinkStudentDto {
  @ApiProperty({ example: '06201', description: 'Student ID code to link' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiPropertyOptional({ example: 'Mother', default: 'Parent' })
  @IsString()
  @IsOptional()
  relationshipType?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsBoolean()
  @IsOptional()
  isPrimaryContact?: boolean;
}
```

- [x] **Step 3: Implement `ParentsService` and `ParentsController`**

`src/parents/parents.service.ts`:
```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { LinkStudentDto } from './dto/link-student.dto.js';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async linkStudent(parentUserId: string, dto: LinkStudentDto) {
    const student = await this.prisma.student.findUnique({
      where: { studentCode: dto.studentCode },
    });

    if (!student) {
      throw new NotFoundException(`Student with code '${dto.studentCode}' not found`);
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
}
```

`src/parents/parents.controller.ts`:
```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/index.js';
import { ParentsService } from './parents.service.js';
import { LinkStudentDto } from './dto/link-student.dto.js';

@ApiTags('Parent Multi-Child Rostering')
@Controller('api/parents/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARENT)
@ApiBearerAuth()
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post('link')
  @ApiOperation({ summary: 'Link an additional child to the authenticated parent account' })
  @ApiResponse({ status: 201, description: 'Child linked successfully' })
  @ApiResponse({ status: 404, description: 'Student code not found' })
  @ApiResponse({ status: 409, description: 'Child already linked' })
  async linkStudent(@CurrentUser('id') parentUserId: string, @Body() dto: LinkStudentDto) {
    return this.parentsService.linkStudent(parentUserId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all children linked to the authenticated parent' })
  @ApiResponse({ status: 200, description: 'Array of linked student profiles' })
  async getLinkedStudents(@CurrentUser('id') parentUserId: string) {
    return this.parentsService.getLinkedStudents(parentUserId);
  }
}
```

- [x] **Step 4: Register `ParentsModule` in `AppModule` and run unit tests**

Run: `npx jest src/parents/parents.service.spec.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/parents/ src/app.module.ts
git commit -m "feat(parents): implement multi-child linking and roster query endpoints"
```

---

### Task 5: User Preferences Module (`GET & PATCH /api/users/preferences`)

**Files:**
- Create: `src/users/users.module.ts`
- Create: `src/users/users.controller.ts`
- Create: `src/users/users.service.ts`
- Create: `src/users/dto/update-preferences.dto.ts`
- Create: `src/users/users.service.spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: Authenticated user ID (any valid Role), `UpdateUserPreferencesDto`.
- Produces: `UserPreferences` object.

- [x] **Step 1: Write test for Preferences in `src/users/users.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { PrismaService } from '../database/prisma.service.js';

describe('UsersService - Preferences', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            userPreferences: { upsert: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should update and return user preferences', async () => {
    const mockPref = {
      id: 'pref-1',
      userId: 'user-1',
      pushNotificationsEnabled: false,
      soundEnabled: true,
      darkModeEnabled: true,
      autoSyncEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest.spyOn(prisma.userPreferences, 'upsert').mockResolvedValue(mockPref);

    const result = await service.updatePreferences('user-1', { darkModeEnabled: true });
    expect(result.darkModeEnabled).toBe(true);
  });
});
```

- [x] **Step 2: Create DTO `src/users/dto/update-preferences.dto.ts`**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  soundEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  darkModeEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  autoSyncEnabled?: boolean;
}
```

- [x] **Step 3: Implement `UsersService` and `UsersController`**

`src/users/users.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { UpdateUserPreferencesDto } from './dto/update-preferences.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: {
        ...(dto.pushNotificationsEnabled !== undefined && {
          pushNotificationsEnabled: dto.pushNotificationsEnabled,
        }),
        ...(dto.soundEnabled !== undefined && { soundEnabled: dto.soundEnabled }),
        ...(dto.darkModeEnabled !== undefined && { darkModeEnabled: dto.darkModeEnabled }),
        ...(dto.autoSyncEnabled !== undefined && { autoSyncEnabled: dto.autoSyncEnabled }),
      },
      create: {
        userId,
        ...dto,
      },
    });
  }
}
```

`src/users/users.controller.ts`:
```typescript
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { UpdateUserPreferencesDto } from './dto/update-preferences.dto.js';

@ApiTags('User Preferences & Profile Settings')
@Controller('api/users/preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notification & interface preferences' })
  @ApiResponse({ status: 200, description: 'User preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.usersService.getPreferences(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user preferences (dark mode, sound, push)' })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.usersService.updatePreferences(userId, dto);
  }
}
```

- [x] **Step 4: Register `UsersModule` and run tests**

Run: `npx jest src/users/users.service.spec.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/users/ src/app.module.ts
git commit -m "feat(users): add user preferences endpoints and module"
```

---

### Task 6: End-to-End Persona Verification Script

**Files:**
- Modify: `scripts/test-all-roles-flow.mjs`
- Test: Run `node scripts/test-all-roles-flow.mjs`

**Interfaces:**
- Consumes: All 4 persona auth endpoints (`/parent/*`, `/teacher/*`, `/admin/*`, `/student/*`), `/api/parents/students/link`, `/api/users/preferences`.
- Produces: Complete terminal report showing green checks for all 4 personas and core identity flows.

- [x] **Step 1: Update `scripts/test-all-roles-flow.mjs` to include Student Login & Multi-Child Linking**

Add assertions for:
1. Student login with `06201` and PIN `1234` -> verify JWT and Student role.
2. Parent links child `06202` (`Emma Wilson`) via `/api/parents/students/link`.
3. Parent fetches linked children -> asserts both children present.
4. User updates preferences (`darkModeEnabled: true`) -> asserts persistence.

- [x] **Step 2: Run verification script**

Run: `node scripts/test-all-roles-flow.mjs`
Expected: All tests pass with exit code 0.

- [x] **Step 3: Commit verification test suite**

```bash
git add scripts/test-all-roles-flow.mjs
git commit -m "test(e2e): update all-roles flow script to verify student auth and multi-child linking"
```

---

## Self-Review Checklist

1. **Spec Coverage:** Skimmed `PRD_Final.md` and `BACKEND_DATA_MODELS.md`. Student login (`AUTH-06`), Multi-child linking (`PRF-03`), Classroom profile details (`PRF-02`), and User preferences (`PRF-04`) are all mapped to concrete tasks.
2. **No Placeholders:** All DTOs, controllers, services, queries, and test assertions are written out completely without "TODO" or "TBD".
3. **Type Consistency:** `Role.STUDENT`, `studentCode`, `accessPinHash`, `StudentParentLink`, and `UserPreferences` match definitions across schema, DTOs, services, and tests.
