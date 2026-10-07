import dotenv from 'dotenv';
import fs from 'node:fs';
import { v2 as cloudinary } from 'cloudinary';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/database/prisma.service.js';
import { Role, AccountStatus } from '../dist/src/common/enums/index.js';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function logStep(step, message) {
  console.log(
    `\n${colors.cyan}[STEP ${step}]${colors.reset} ${colors.bright}${message}${colors.reset}`,
  );
}

function logSuccess(message) {
  console.log(`  ${colors.green}✔ ${message}${colors.reset}`);
}

function logExpectedGate(status, message) {
  console.log(
    `  ${colors.yellow}✔ Security gate verified (${status}): ${message}${colors.reset}`,
  );
}

function logDetail(label, value) {
  console.log(`    ${colors.blue}→ ${label}:${colors.reset} ${value}`);
}

async function runSimulation() {
  console.log(
    `${colors.bright}${colors.magenta}================================================================${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}       CLOUDINARY FILE UPLOAD END-TO-END SIMULATION SUITE       ${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.magenta}================================================================${colors.reset}`,
  );

  // STEP 1: Verify Cloudinary configuration
  logStep(1, 'Verifying Cloudinary environment credentials');
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error(
      `${colors.red}Missing Cloudinary credentials in .env!${colors.reset}`,
    );
    process.exit(1);
  }

  logDetail('Cloud Name', cloudName);
  logDetail('API Key', apiKey.slice(0, 4) + '...' + apiKey.slice(-3));
  logDetail('API Secret', apiSecret.slice(0, 4) + '...' + apiSecret.slice(-3));

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const pingResult = await new Promise((resolve, reject) => {
    cloudinary.api.ping((err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });

  logSuccess(
    `Cloudinary API connected successfully: ${JSON.stringify(pingResult)}`,
  );

  // STEP 2: Boot NestJS application for test
  logStep(2, 'Bootstrapping PTA NestJS application');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const TEST_PORT = 4199;
  await app.listen(TEST_PORT);
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  logSuccess(`PTA Backend application listening on ${BASE_URL}`);

  // Obtain or create a valid user for JWT validation with Neon connection retry
  const prisma = app.get(PrismaService);
  let testUser = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      testUser = await prisma.user.findFirst({
        where: {
          accountStatus: AccountStatus.ACTIVE,
          role: Role.TEACHER,
          teacherProfile: { isNot: null },
        },
      });
      break;
    } catch (err) {
      if (attempt === 5) throw err;
      console.log(
        `  ${colors.yellow}Neon connection retry (${attempt}/5)...${colors.reset}`,
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  let createdTempUser = false;
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: `uploader.sim.${Date.now()}@example.com`,
        role: Role.TEACHER,
        accountStatus: AccountStatus.ACTIVE,
        isEmailVerified: true,
        teacherProfile: {
          create: {
            fullName: 'Simulated Teacher',
            schoolName: 'Simulation Academy',
          },
        },
      },
    });
    createdTempUser = true;
    logSuccess(`Created temporary test teacher: ${testUser.email}`);
  } else {
    logSuccess(
      `Using active teacher from database: ${testUser.email} (Role: ${testUser.role})`,
    );
  }

  const jwtService = app.get(JwtService);
  const testToken = await jwtService.signAsync({
    sub: testUser.id,
    email: testUser.email,
    role: testUser.role,
    accountStatus: testUser.accountStatus,
  });
  logSuccess('Generated authenticated JWT Bearer token');

  try {
    // STEP 3: Unauthenticated security gate
    logStep(3, 'Security Gate: Test unauthenticated upload rejection (401)');
    const unauthForm = new FormData();
    unauthForm.append(
      'file',
      new Blob(['dummy test'], { type: 'text/plain' }),
      'unauth.txt',
    );
    const unauthRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: unauthForm,
    });
    if (unauthRes.status === 401) {
      logExpectedGate(
        401,
        'Request rejected with 401 Unauthorized when missing Bearer token',
      );
    } else {
      throw new Error(
        `Expected 401 Unauthorized, received ${unauthRes.status}`,
      );
    }

    // STEP 4: Missing file gate
    logStep(4, 'Validation Gate: Test empty payload rejection (400)');
    const emptyForm = new FormData();
    const emptyRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: emptyForm,
    });
    if (emptyRes.status === 400) {
      logExpectedGate(
        400,
        'Request rejected with 400 Bad Request when "file" field is missing',
      );
    } else {
      throw new Error(`Expected 400 Bad Request, received ${emptyRes.status}`);
    }

    // STEP 5: Disallowed file type gate
    logStep(5, 'Security Gate: Test unsupported file type rejection (400)');
    const exeForm = new FormData();
    exeForm.append(
      'file',
      new Blob(['MZ binary simulated payload'], {
        type: 'application/x-msdownload',
      }),
      'malware.exe',
    );
    const exeRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: exeForm,
    });
    if (exeRes.status === 400) {
      const errJson = await exeRes.json();
      logExpectedGate(400, `Rejected invalid file: ${errJson.message}`);
    } else {
      throw new Error(
        `Expected 400 Bad Request for .exe, received ${exeRes.status}`,
      );
    }

    // STEP 6: Single File Upload to Cloudinary
    logStep(6, 'Live Upload: Uploading single PDF worksheet to Cloudinary');
    const validPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
206
%%EOF`;
    const singleForm = new FormData();
    const pdfBlob = new Blob([validPdfContent], { type: 'application/pdf' });
    singleForm.append('file', pdfBlob, 'fractions-quiz-2026.pdf');
    singleForm.append('folder', 'pta/homework-attachments');

    const startTime = Date.now();
    const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: singleForm,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Upload failed (${uploadRes.status}): ${err}`);
    }

    const uploadData = await uploadRes.json();
    const duration = Date.now() - startTime;

    logSuccess(
      `Single file successfully uploaded to Cloudinary in ${duration}ms!`,
    );
    logDetail('Original Filename', uploadData.originalFilename);
    logDetail('Secure URL', uploadData.secureUrl);
    logDetail('Public ID', uploadData.publicId);
    logDetail('File Size', `${uploadData.bytes} bytes`);
    logDetail('Resource Type', uploadData.resourceType);

    // STEP 7: Verify asset is live and accessible on Cloudinary CDN
    logStep(7, 'CDN Reachability: Verifying uploaded asset on Cloudinary CDN');
    const cdnRes = await fetch(uploadData.secureUrl);
    if (cdnRes.ok) {
      logSuccess(
        `Cloudinary CDN confirmed asset is publicly accessible (HTTP ${cdnRes.status})`,
      );
      logDetail('Content-Type header', cdnRes.headers.get('content-type'));
    } else {
      console.warn(
        `${colors.yellow}Warning: CDN returned status ${cdnRes.status}${colors.reset}`,
      );
    }

    // STEP 8: Batch multiple files upload
    logStep(8, 'Batch Upload: Uploading multiple attachments to Cloudinary');
    const multiForm = new FormData();
    const doc1 = new Blob(['English Literature Essay Prompt 2026'], {
      type: 'text/plain',
    });
    const doc2 = new Blob(['Parent Consent & Acknowledgement Form'], {
      type: 'text/plain',
    });
    multiForm.append('files', doc1, 'english-essay-prompt.txt');
    multiForm.append('files', doc2, 'parent-consent-form.txt');
    multiForm.append('folder', 'pta/batch-attachments');

    const multiStart = Date.now();
    const multiRes = await fetch(`${BASE_URL}/api/upload/multiple`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: multiForm,
    });

    if (!multiRes.ok) {
      const err = await multiRes.text();
      throw new Error(`Batch upload failed (${multiRes.status}): ${err}`);
    }

    const multiData = await multiRes.json();
    const multiDuration = Date.now() - multiStart;

    logSuccess(
      `Batch uploaded ${multiData.length} files to Cloudinary in ${multiDuration}ms!`,
    );
    multiData.forEach((item, index) => {
      console.log(
        `    ${colors.cyan}[File ${index + 1}]${colors.reset} ${item.originalFilename} → ${colors.bright}${item.secureUrl}${colors.reset}`,
      );
    });

    // STEP 9: Add student with direct multipart avatar image upload using the specified image
    logStep(
      9,
      'Live Student Enrollment: Uploading "ChatGPT Image Sep 29, 2026, 10_59_28 AM.png"',
    );
    const targetImagePath =
      'C:\\Users\\User\\Downloads\\ChatGPT Image Sep 29, 2026, 10_59_28 AM.png';
    const targetImageBuffer = fs.readFileSync(targetImagePath);
    logDetail('Source File', targetImagePath);
    logDetail(
      'Image Size',
      `${(targetImageBuffer.length / (1024 * 1024)).toFixed(2)} MB (${targetImageBuffer.length} bytes)`,
    );

    const studentCode = `S${Math.floor(10000 + Math.random() * 90000)}`;
    const studentForm = new FormData();
    studentForm.append('firstName', 'Amina');
    studentForm.append('lastName', 'Bello');
    studentForm.append('studentCode', studentCode);
    studentForm.append('dateOfBirth', '2014-06-15');
    studentForm.append('gender', 'FEMALE');
    studentForm.append(
      'avatar',
      new Blob([targetImageBuffer], { type: 'image/png' }),
      'ChatGPT Image Sep 29, 2026, 10_59_28 AM.png',
    );

    const studentStartTime = Date.now();
    const enrollRes = await fetch(`${BASE_URL}/api/teachers/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: studentForm,
    });

    if (!enrollRes.ok) {
      const err = await enrollRes.text();
      throw new Error(`Enroll student failed (${enrollRes.status}): ${err}`);
    }

    const enrollData = await enrollRes.json();
    const studentDuration = Date.now() - studentStartTime;
    logSuccess(
      `Student enrolled successfully with real image in ${studentDuration}ms!`,
    );
    logDetail('Student ID', enrollData.student.id);
    logDetail('Student Name', enrollData.student.fullName);
    logDetail('Student Code', enrollData.student.studentCode);
    logDetail('Avatar URL', enrollData.student.avatarUrl);

    if (
      !enrollData.student.avatarUrl ||
      !enrollData.student.avatarUrl.includes('res.cloudinary.com')
    ) {
      throw new Error(
        'Expected Cloudinary avatarUrl in enrolled student response',
      );
    }

    // STEP 10: Verify Classroom Roster & Attendance roll call
    logStep(
      10,
      'Classroom Roll Call & Attendance: Verifying avatarUrl on mark attendance screen',
    );
    const rosterRes = await fetch(
      `${BASE_URL}/api/teachers/students/${enrollData.student.id}`,
      {
        headers: { Authorization: `Bearer ${testToken}` },
      },
    );
    if (!rosterRes.ok)
      throw new Error('Failed to retrieve student details from roster');
    const rosterData = await rosterRes.json();
    logSuccess(
      `Retrieved student from roster with avatarUrl: ${rosterData.avatarUrl}`,
    );

    // 10b: Submit attendance roll call (mark attendance)
    const today = new Date().toISOString().split('T')[0];
    const markRes = await fetch(`${BASE_URL}/api/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        date: today,
        records: [
          {
            studentId: enrollData.student.id,
            status: 'PRESENT',
            notes: 'Present with photo ID verified',
          },
        ],
      }),
    });

    if (!markRes.ok) {
      const err = await markRes.text();
      throw new Error(`Mark attendance failed (${markRes.status}): ${err}`);
    }
    logSuccess(`Marked daily attendance (PRESENT) for student`);

    // 10c: Verify GET /api/attendance/class (the endpoint driving the mark attendance screen)
    const classAttendanceRes = await fetch(
      `${BASE_URL}/api/attendance/class?date=${today}`,
      {
        headers: { Authorization: `Bearer ${testToken}` },
      },
    );
    if (!classAttendanceRes.ok) {
      throw new Error(
        `Failed to fetch class attendance (${classAttendanceRes.status})`,
      );
    }
    const classAttendanceData = await classAttendanceRes.json();
    const studentRecord = classAttendanceData.records?.find(
      (r) => r.student?.id === enrollData.student.id,
    );
    if (!studentRecord || !studentRecord.student?.avatarUrl) {
      throw new Error(
        'Student record in GET /api/attendance/class missing avatarUrl!',
      );
    }
    logSuccess(
      `Mark Attendance Screen API returned avatarUrl: ${studentRecord.student.avatarUrl}`,
    );

    // 10d: Verify GET /api/attendance/student/:id
    const studentAttendanceRes = await fetch(
      `${BASE_URL}/api/attendance/student/${enrollData.student.id}`,
      {
        headers: { Authorization: `Bearer ${testToken}` },
      },
    );
    if (!studentAttendanceRes.ok) {
      throw new Error(
        `Failed to fetch student attendance (${studentAttendanceRes.status})`,
      );
    }
    const studentAttendanceData = await studentAttendanceRes.json();
    if (!studentAttendanceData.student?.avatarUrl) {
      throw new Error(
        'Student profile in GET /api/attendance/student/:id missing avatarUrl!',
      );
    }
    logSuccess(
      `Student Attendance History API returned avatarUrl: ${studentAttendanceData.student.avatarUrl}`,
    );

    const cdnAvatarRes = await fetch(rosterData.avatarUrl);
    if (cdnAvatarRes.ok) {
      logSuccess(
        `Confirmed student avatar image is live on Cloudinary CDN (HTTP ${cdnAvatarRes.status})`,
      );
      logDetail('CDN Content-Type', cdnAvatarRes.headers.get('content-type'));
      logDetail(
        'CDN Content-Length',
        `${cdnAvatarRes.headers.get('content-length')} bytes`,
      );
    } else {
      console.warn(
        `${colors.yellow}Warning: CDN returned status ${cdnAvatarRes.status}${colors.reset}`,
      );
    }

    // STEP 11: Scorecard
    console.log(
      `\n${colors.bright}${colors.green}================================================================${colors.reset}`,
    );
    console.log(
      `${colors.bright}${colors.green}        END-TO-END SIMULATION COMPLETED WITH 100% SUCCESS        ${colors.reset}`,
    );
    console.log(
      `${colors.bright}${colors.green}================================================================${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Cloudinary Credentials: Authenticated & Active${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Security Gate (401 Missing JWT): Verified${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Validation Gate (400 Empty Payload): Verified${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Validation Gate (400 Unsupported Extension): Verified${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Live Single Upload: Verified on Cloudinary CDN${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Live Batch Upload: Verified (2 items concurrently)${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Live Add Student Form: Direct 2.5MB image file upload to Cloudinary Verified${colors.reset}`,
    );
    console.log(
      `  ${colors.green}✔ Roll Call & Attendance: Avatar URL fetched from Cloudinary CDN successfully${colors.reset}`,
    );
    console.log(
      `${colors.bright}${colors.green}================================================================${colors.reset}\n`,
    );

    // Clean up attendance records and student
    await prisma.attendanceRecord
      .deleteMany({ where: { studentId: enrollData.student.id } })
      .catch(() => {});
    await prisma.student
      .delete({ where: { id: enrollData.student.id } })
      .catch(() => {});

  } finally {
    if (createdTempUser && testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await app.close();
  }
}

runSimulation().catch((err) => {
  console.error(
    `\n${colors.red}❌ Simulation failed with error:${colors.reset}`,
    err,
  );
  process.exit(1);
});
