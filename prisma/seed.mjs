import pg from 'pg';
import dotenv from 'dotenv';
import * as argon2 from 'argon2';
import crypto from 'node:crypto';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('Seeding initial teacher and student roster for ConnectEd...');

  // 1. Seed Teacher: Miss Edith Robinson
  const teacherEmail = 'edith.robinson@afrotech.edu';
  const teacherPasswordHash = await argon2.hash('Teacher@1234');

  let teacherUserRes = await pool.query('SELECT id FROM users WHERE email = $1', [teacherEmail]);
  let teacherUserId;

  if (teacherUserRes.rows.length === 0) {
    teacherUserId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, "passwordHash", role, "accountStatus", "isEmailVerified", "emailVerifiedAt", "termsAccepted", "termsAcceptedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'TEACHER', 'ACTIVE', true, NOW(), true, NOW(), NOW(), NOW())`,
      [teacherUserId, teacherEmail, teacherPasswordHash]
    );
  } else {
    teacherUserId = teacherUserRes.rows[0].id;
    await pool.query(
      `UPDATE users SET "passwordHash" = $1, "accountStatus" = 'ACTIVE', "isEmailVerified" = true, "updatedAt" = NOW() WHERE id = $2`,
      [teacherPasswordHash, teacherUserId]
    );
  }

  // Teacher Profile
  let teacherProfileRes = await pool.query('SELECT id FROM teacher_profiles WHERE "userId" = $1', [teacherUserId]);
  let teacherProfileId;

  if (teacherProfileRes.rows.length === 0) {
    teacherProfileId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO teacher_profiles (id, "userId", "fullName", "schoolName", phone, "subjectSpecialization", "assignedGrade", "roomNumber", "studentCapacity", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        teacherProfileId,
        teacherUserId,
        'Miss Edith Robinson',
        'Afrotech Academy',
        '+2348011223344',
        'Mathematics',
        'Grade 5',
        'Room 201',
        35,
      ]
    );
  } else {
    teacherProfileId = teacherProfileRes.rows[0].id;
    await pool.query(
      `UPDATE teacher_profiles 
       SET "fullName" = 'Miss Edith Robinson', "schoolName" = 'Afrotech Academy', "assignedGrade" = 'Grade 5', "roomNumber" = 'Room 201', "studentCapacity" = 35, "updatedAt" = NOW()
       WHERE id = $1`,
      [teacherProfileId]
    );
  }

  // Teacher Preferences
  await pool.query(
    `INSERT INTO user_preferences (id, "userId", "pushNotificationsEnabled", "soundEnabled", "darkModeEnabled", "autoSyncEnabled", "createdAt", "updatedAt")
     VALUES ($1, $2, true, true, false, true, NOW(), NOW())
     ON CONFLICT ("userId") DO NOTHING`,
    [crypto.randomUUID(), teacherUserId]
  );

  console.log(`Teacher seeded: Miss Edith Robinson (${teacherEmail}) -> Profile ID: ${teacherProfileId}`);

  // 2. Seed Default PIN Hash for '1234'
  const defaultPinHash = await argon2.hash('1234');

  const students = [
    {
      studentCode: '06201',
      firstName: 'Divine',
      lastName: 'Ekubor',
      dateOfBirth: '2014-05-14',
      gender: 'MALE',
      grade: 'Grade 5',
      room: 'Room 201',
    },
    {
      studentCode: '06202',
      firstName: 'Emma',
      lastName: 'Wilson',
      dateOfBirth: '2014-08-22',
      gender: 'FEMALE',
      grade: 'Grade 5',
      room: 'Room 201',
    },
    {
      studentCode: '06204',
      firstName: 'Bryan',
      lastName: 'Williams',
      dateOfBirth: '2014-02-10',
      gender: 'MALE',
      grade: 'Grade 5',
      room: 'Room 201',
    },
  ];

  for (const s of students) {
    const studentEmail = `${s.studentCode.toLowerCase()}@student.afrotech.edu`;
    let userRes = await pool.query('SELECT id FROM users WHERE email = $1', [studentEmail]);
    let studentUserId;

    if (userRes.rows.length === 0) {
      studentUserId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, "passwordHash", role, "accountStatus", "isEmailVerified", "emailVerifiedAt", "termsAccepted", "termsAcceptedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, NULL, 'STUDENT', 'ACTIVE', true, NOW(), true, NOW(), NOW(), NOW())`,
        [studentUserId, studentEmail]
      );
    } else {
      studentUserId = userRes.rows[0].id;
    }

    // Student Preferences
    await pool.query(
      `INSERT INTO user_preferences (id, "userId", "pushNotificationsEnabled", "soundEnabled", "darkModeEnabled", "autoSyncEnabled", "createdAt", "updatedAt")
       VALUES ($1, $2, true, true, false, true, NOW(), NOW())
       ON CONFLICT ("userId") DO NOTHING`,
      [crypto.randomUUID(), studentUserId]
    );

    // Upsert Student Profile
    const studentRes = await pool.query('SELECT id FROM students WHERE "studentCode" = $1', [s.studentCode]);
    if (studentRes.rows.length === 0) {
      await pool.query(
        `INSERT INTO students (id, "userId", "studentCode", "firstName", "lastName", "dateOfBirth", gender, grade, room, "accessPinHash", "primaryTeacherId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          studentUserId,
          s.studentCode,
          s.firstName,
          s.lastName,
          s.dateOfBirth,
          s.gender,
          s.grade,
          s.room,
          defaultPinHash,
          teacherProfileId,
        ]
      );
    } else {
      await pool.query(
        `UPDATE students 
         SET "userId" = $1, "firstName" = $2, "lastName" = $3, "dateOfBirth" = $4, gender = $5, grade = $6, room = $7, "accessPinHash" = $8, "primaryTeacherId" = $9, "updatedAt" = NOW()
         WHERE "studentCode" = $10`,
        [
          studentUserId,
          s.firstName,
          s.lastName,
          s.dateOfBirth,
          s.gender,
          s.grade,
          s.room,
          defaultPinHash,
          teacherProfileId,
          s.studentCode,
        ]
      );
    }

    console.log(`Student seeded: ${s.firstName} ${s.lastName} [${s.studentCode}] -> Teacher: Miss Edith Robinson`);
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
