import crypto from 'node:crypto';
import http from 'node:http';
import pg from 'pg';
import dotenv from 'dotenv';
import * as argon2 from 'argon2';


dotenv.config();

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not defined in environment');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.warn('Neon pool background notice:', err.message);
});

async function query(text, params) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

function resolveOtpFromHash(targetHash) {
  for (let i = 100000; i <= 999999; i++) {
    const candidate = i.toString();
    const hash = crypto.createHash('sha256').update(candidate).digest('hex');
    if (hash === targetHash) {
      return candidate;
    }
  }
  return null;
}

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

function banner(text) {
  console.log(`\n${colors.bright}${colors.blue}================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}   ${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}================================================================${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}[STEP ${step}]${colors.reset} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`  ${colors.green}✔ ${message}${colors.reset}`);
}

function logNotice(message) {
  console.log(`  ${colors.magenta}ℹ ${message}${colors.reset}`);
}

function logSecurity(message) {
  console.log(`  ${colors.yellow}🛡 ${message}${colors.reset}`);
}

function requestJson(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyData = options.body || '';
    const headers = {
      'Content-Type': 'application/json',
      'Connection': 'close',
      ...(options.headers || {}),
    };
    if (bodyData) {
      headers['Content-Length'] = Buffer.byteLength(bodyData);
    }
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = {};
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timeout'));
    });
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runAllRolesFlow() {
  banner('PTA DATABASE PURGE & COMPLETE 3-ROLE AUTHENTICATION FLOW');
  console.log(`Target Backend: ${colors.cyan}${BASE_URL}${colors.reset}`);
  console.log(`Neon Database:  ${colors.cyan}Connecting...${colors.reset}`);

  await query('SELECT 1');
  console.log(`Neon Database:  ${colors.green}Connected${colors.reset}`);

  // ==========================================
  // PART 1: COMPLETE DATABASE PURGE
  // ==========================================
  logStep('0.0', 'PURGING ALL USERS AND ASSOCIATED RECORDS FROM DATABASE');

  const beforeCount = await query('SELECT count(*)::int as count FROM users');
  console.log(`  Existing users prior to purge: ${beforeCount.rows[0].count}`);

  await query('DELETE FROM verification_codes');
  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM student_parent_links');
  await query('DELETE FROM students');
  await query('DELETE FROM user_preferences');
  await query('DELETE FROM parent_profiles');
  await query('DELETE FROM teacher_profiles');
  await query('DELETE FROM users');


  const afterCount = await query('SELECT count(*)::int as count FROM users');
  if (afterCount.rows[0].count !== 0) {
    throw new Error(`Purge failed. Remaining users: ${afterCount.rows[0].count}`);
  }
  logSuccess(`Database fully wiped. Current user count: ${afterCount.rows[0].count}`);

  // Test accounts
  const parentEmail = 'yusuf.samaila@outsourceglobal.com';
  const teacherEmail = 'yusuf7samaila@gmail.com';
  const adminEmail = 'yusuf.hilside@gmail.com';

  const initialPassword = 'InitialP@ssword123!';
  const changedPassword = 'UpdatedP@ssword456!';
  const resetPassword = 'ResetP@ssword789!';

  const results = {
    parent: {},
    teacher: {},
    admin: {},
    forgotPasswordFlow: {},
  };

  // ==========================================
  // PART 2: PARENT FLOW
  // ==========================================
  banner('ROLE 1: PARENT COMPLETE AUTH FLOW');

  logStep('1.1', `Sign up Parent: ${parentEmail}`);
  const parentReg = await requestJson(`${BASE_URL}/api/auth/parent/register`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'parent',
      fullName: 'Yusuf Samaila (Parent)',
      email: parentEmail,
      schoolName: 'Apex International Academy',
      studentCode: 'APX-99201',
      password: initialPassword,
      confirmPassword: initialPassword,
      termsAccepted: true,
    }),
  });
  if (parentReg.status !== 201) throw new Error(`Parent signup failed: ${JSON.stringify(parentReg.data)}`);
  logSuccess(`Parent registered [Status: ${parentReg.data.user.accountStatus}]`);
  results.parent.signup = true;

  logStep('1.2', 'Resolving OTP from database and email dispatch');
  const parentCodeRow = await query(
    `SELECT vc."codeHash" FROM verification_codes vc 
     JOIN users u ON u.id = vc."userId" 
     WHERE u.email = $1 AND vc.type = 'EMAIL_VERIFICATION' AND vc."usedAt" IS NULL 
     ORDER BY vc."createdAt" DESC LIMIT 1`,
    [parentEmail]
  );
  const parentOtp = resolveOtpFromHash(parentCodeRow.rows[0].codeHash);
  logNotice(`Retrieved 6-Digit OTP: [${parentOtp}] for ${parentEmail}`);

  logStep('1.3', 'Verifying Parent Email via OTP');
  const parentVerify = await requestJson(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ email: parentEmail, code: parentOtp }),
  });
  if (parentVerify.status !== 200) throw new Error(`Parent verify failed: ${JSON.stringify(parentVerify.data)}`);
  logSuccess(`Parent email verified. Account Status: ${parentVerify.data.user.accountStatus}`);
  results.parent.verification = true;

  logStep('1.4', 'Parent Login with initial password');
  const parentLogin1 = await requestJson(`${BASE_URL}/api/auth/parent/login`, {
    method: 'POST',
    body: JSON.stringify({ email: parentEmail, password: initialPassword }),
  });
  if (parentLogin1.status !== 200) throw new Error(`Parent login failed: ${JSON.stringify(parentLogin1.data)}`);
  logSuccess(`Parent login succeeded. AccessToken generated.`);
  results.parent.initialLogin = true;

  const parentAccessToken = parentLogin1.data.tokens.accessToken;

  logStep('1.5', 'Fetching Parent Profile (/api/auth/me)');
  const parentMe = await requestJson(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${parentAccessToken}` },
  });
  if (parentMe.status !== 200) throw new Error(`Parent me failed: ${JSON.stringify(parentMe.data)}`);
  logSuccess(`Profile confirmed: ${parentMe.data.profile.fullName} [Role: ${parentMe.data.role}]`);

  logStep('1.6', 'Parent Password Change (change-password)');
  const parentChangePass = await requestJson(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${parentAccessToken}` },
    body: JSON.stringify({
      currentPassword: initialPassword,
      newPassword: changedPassword,
    }),
  });
  if (parentChangePass.status !== 200) throw new Error(`Password change failed: ${JSON.stringify(parentChangePass.data)}`);
  logSuccess(`Password changed successfully.`);
  results.parent.passwordChange = true;

  logStep('1.7', 'Testing Login with OLD Password (must fail)');
  const parentOldLogin = await requestJson(`${BASE_URL}/api/auth/parent/login`, {
    method: 'POST',
    body: JSON.stringify({ email: parentEmail, password: initialPassword }),
  });
  if (parentOldLogin.status === 401) {
    logSecurity(`Security verified: Old password rejected with 401 Unauthorized.`);
  } else {
    throw new Error(`Old password unexpectedly accepted! Status: ${parentOldLogin.status}`);
  }

  logStep('1.8', 'Parent Login with NEW Password');
  const parentNewLogin = await requestJson(`${BASE_URL}/api/auth/parent/login`, {
    method: 'POST',
    body: JSON.stringify({ email: parentEmail, password: changedPassword }),
  });
  if (parentNewLogin.status !== 200) throw new Error(`New password login failed: ${JSON.stringify(parentNewLogin.data)}`);
  logSuccess(`Login with new password succeeded!`);
  results.parent.newPasswordLogin = true;

  // ==========================================
  // PART 3: TEACHER FLOW
  // ==========================================
  banner('ROLE 2: TEACHER COMPLETE AUTH FLOW');

  logStep('2.1', `Sign up Teacher: ${teacherEmail}`);
  const teacherReg = await requestJson(`${BASE_URL}/api/auth/teacher/register`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'teacher',
      fullName: 'Mr. Yusuf Samaila (Teacher)',
      workEmail: teacherEmail,
      schoolName: 'Apex International Academy',
      password: initialPassword,
      confirmPassword: initialPassword,
      termsAccepted: true,
    }),
  });
  if (teacherReg.status !== 201) throw new Error(`Teacher signup failed: ${JSON.stringify(teacherReg.data)}`);
  logSuccess(`Teacher registered [Status: ${teacherReg.data.user.accountStatus}]`);
  results.teacher.signup = true;

  logStep('2.2', 'Resolving Teacher OTP code');
  const teacherCodeRow = await query(
    `SELECT vc."codeHash" FROM verification_codes vc 
     JOIN users u ON u.id = vc."userId" 
     WHERE u.email = $1 AND vc.type = 'EMAIL_VERIFICATION' AND vc."usedAt" IS NULL 
     ORDER BY vc."createdAt" DESC LIMIT 1`,
    [teacherEmail]
  );
  const teacherOtp = resolveOtpFromHash(teacherCodeRow.rows[0].codeHash);
  logNotice(`Retrieved 6-Digit OTP: [${teacherOtp}] for ${teacherEmail}`);

  logStep('2.3', 'Verifying Teacher Email via OTP');
  const teacherVerify = await requestJson(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ email: teacherEmail, code: teacherOtp }),
  });
  if (teacherVerify.status !== 200) throw new Error(`Teacher verify failed: ${JSON.stringify(teacherVerify.data)}`);
  logSuccess(`Teacher email verified. Account Status transitioned to: ${teacherVerify.data.user.accountStatus}`);
  results.teacher.verification = true;

  logStep('2.4', 'Testing Login before Admin Approval (must fail with 403)');
  const teacherPreApprovalLogin = await requestJson(`${BASE_URL}/api/auth/teacher/login`, {
    method: 'POST',
    body: JSON.stringify({ email: teacherEmail, password: initialPassword }),
  });
  if (teacherPreApprovalLogin.status === 403) {
    logSecurity(`Security verified: Teacher login rejected with 403 (${teacherPreApprovalLogin.data.message})`);
  } else {
    throw new Error(`Teacher login before approval unexpectedly succeeded! Status: ${teacherPreApprovalLogin.status}`);
  }

  logStep('2.5', 'Admin Approves Teacher (Simulating administrator review)');
  await query(`UPDATE users SET "accountStatus" = 'ACTIVE' WHERE email = $1`, [teacherEmail]);
  logSuccess(`Teacher account approved and set to ACTIVE in Neon DB.`);

  logStep('2.6', 'Teacher Login after approval');
  const teacherLogin1 = await requestJson(`${BASE_URL}/api/auth/teacher/login`, {
    method: 'POST',
    body: JSON.stringify({ email: teacherEmail, password: initialPassword }),
  });
  if (teacherLogin1.status !== 200) throw new Error(`Teacher login failed: ${JSON.stringify(teacherLogin1.data)}`);
  logSuccess(`Teacher login succeeded. AccessToken generated.`);
  results.teacher.initialLogin = true;

  const teacherAccessToken = teacherLogin1.data.tokens.accessToken;

  logStep('2.7', 'Teacher Password Change (change-password)');
  const teacherChangePass = await requestJson(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherAccessToken}` },
    body: JSON.stringify({
      currentPassword: initialPassword,
      newPassword: changedPassword,
    }),
  });
  if (teacherChangePass.status !== 200) throw new Error(`Teacher password change failed: ${JSON.stringify(teacherChangePass.data)}`);
  logSuccess(`Teacher password changed successfully.`);
  results.teacher.passwordChange = true;

  logStep('2.8', 'Teacher Login with NEW Password');
  const teacherNewLogin = await requestJson(`${BASE_URL}/api/auth/teacher/login`, {
    method: 'POST',
    body: JSON.stringify({ email: teacherEmail, password: changedPassword }),
  });
  if (teacherNewLogin.status !== 200) throw new Error(`Teacher new password login failed: ${JSON.stringify(teacherNewLogin.data)}`);
  logSuccess(`Teacher login with new password succeeded!`);
  results.teacher.newPasswordLogin = true;

  // ==========================================
  // PART 4: ADMIN FLOW
  // ==========================================
  banner('ROLE 3: ADMIN COMPLETE AUTH FLOW');

  logStep('3.1', `Sign up Admin: ${adminEmail}`);
  const adminReg = await requestJson(`${BASE_URL}/api/auth/admin/register`, {
    method: 'POST',
    body: JSON.stringify({
      email: adminEmail,
      password: initialPassword,
      fullName: 'Yusuf Hilside (System Admin)',
    }),
  });
  if (adminReg.status !== 201) throw new Error(`Admin signup failed: ${JSON.stringify(adminReg.data)}`);
  logSuccess(`Admin registered [Role: ${adminReg.data.user.role} | Status: ${adminReg.data.user.accountStatus}]`);
  results.admin.signup = true;

  logStep('3.2', 'Resolving Admin OTP code');
  const adminCodeRow = await query(
    `SELECT vc."codeHash" FROM verification_codes vc 
     JOIN users u ON u.id = vc."userId" 
     WHERE u.email = $1 AND vc.type = 'EMAIL_VERIFICATION' AND vc."usedAt" IS NULL 
     ORDER BY vc."createdAt" DESC LIMIT 1`,
    [adminEmail]
  );
  const adminOtp = resolveOtpFromHash(adminCodeRow.rows[0].codeHash);
  logNotice(`Retrieved 6-Digit OTP: [${adminOtp}] for ${adminEmail}`);

  logStep('3.3', 'Verifying Admin Email via OTP');
  const adminVerify = await requestJson(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, code: adminOtp }),
  });
  if (adminVerify.status !== 200) throw new Error(`Admin verify failed: ${JSON.stringify(adminVerify.data)}`);
  logSuccess(`Admin email verified. Account Status: ${adminVerify.data.user.accountStatus}`);
  results.admin.verification = true;

  logStep('3.4', 'Admin Login with initial password');
  const adminLogin1 = await requestJson(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: initialPassword }),
  });
  if (adminLogin1.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin1.data)}`);
  logSuccess(`Admin login succeeded. AccessToken generated.`);
  results.admin.initialLogin = true;

  const adminAccessToken = adminLogin1.data.tokens.accessToken;

  logStep('3.5', 'Admin Password Change (change-password)');
  const adminChangePass = await requestJson(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAccessToken}` },
    body: JSON.stringify({
      currentPassword: initialPassword,
      newPassword: changedPassword,
    }),
  });
  if (adminChangePass.status !== 200) throw new Error(`Admin password change failed: ${JSON.stringify(adminChangePass.data)}`);
  logSuccess(`Admin password changed successfully.`);
  results.admin.passwordChange = true;

  logStep('3.6', 'Admin Login with NEW Password');
  const adminNewLogin = await requestJson(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: changedPassword }),
  });
  if (adminNewLogin.status !== 200) throw new Error(`Admin new password login failed: ${JSON.stringify(adminNewLogin.data)}`);
  logSuccess(`Admin login with new password succeeded!`);
  results.admin.newPasswordLogin = true;

  // ==========================================
  // PART 5: FORGOT & RESET PASSWORD FLOW
  // ==========================================
  banner('ROLE 1: FORGOT PASSWORD & RESET WITH OTP FLOW');

  logStep('4.1', `Initiating Forgot Password for Parent: ${parentEmail}`);
  const forgotRes = await requestJson(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email: parentEmail }),
  });
  if (forgotRes.status !== 200) throw new Error(`Forgot password failed: ${JSON.stringify(forgotRes.data)}`);
  logSuccess(`Forgot password initiated: "${forgotRes.data.message}"`);

  logStep('4.2', 'Resolving Password Reset OTP from database');
  const resetCodeRow = await query(
    `SELECT vc."codeHash" FROM verification_codes vc 
     JOIN users u ON u.id = vc."userId" 
     WHERE u.email = $1 AND vc.type = 'PASSWORD_RESET' AND vc."usedAt" IS NULL 
     ORDER BY vc."createdAt" DESC LIMIT 1`,
    [parentEmail]
  );
  const resetOtp = resolveOtpFromHash(resetCodeRow.rows[0].codeHash);
  logNotice(`Retrieved 6-Digit Password Reset OTP: [${resetOtp}] for ${parentEmail}`);

  logStep('4.3', 'Executing Password Reset with OTP');
  const resetRes = await requestJson(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({
      email: parentEmail,
      code: resetOtp,
      newPassword: resetPassword,
    }),
  });
  if (resetRes.status !== 200) throw new Error(`Password reset failed: ${JSON.stringify(resetRes.data)}`);
  logSuccess(`Password reset confirmed: "${resetRes.data.message}"`);
  results.forgotPasswordFlow.resetSuccess = true;

  logStep('4.4', 'Parent Login with Reset Password');
  const parentResetLogin = await requestJson(`${BASE_URL}/api/auth/parent/login`, {
    method: 'POST',
    body: JSON.stringify({ email: parentEmail, password: resetPassword }),
  });
  if (parentResetLogin.status !== 200) throw new Error(`Login after reset failed: ${JSON.stringify(parentResetLogin.data)}`);
  results.forgotPasswordFlow.loginWithResetPassword = true;
  const activeParentToken = parentResetLogin.data.tokens.accessToken;


  // ==========================================
  // PART 5: ROLE 4 - STUDENT AUTHENTICATION FLOW
  // ==========================================
  banner('ROLE 4: STUDENT AUTHENTICATION VIA STUDENT ID & PIN');

  logStep('5.0', 'Seeding Prototype Students (Divine Ekubor 06201, Emma Wilson 06202, Bryan Williams 06204)');
  const teacherRow = await query('SELECT tp.id, tp."schoolName" FROM teacher_profiles tp JOIN users u ON u.id = tp."userId" WHERE u.email = $1', [teacherEmail]);
  const primaryTeacherId = teacherRow.rows[0]?.id;
  const pinHash = await argon2.hash('1234');
  
  const studentList = [
    { code: '06201', first: 'Divine', last: 'Ekubor', dob: '2014-05-14', gender: 'MALE', grade: 'Grade 5', room: 'Room 201' },
    { code: '06202', first: 'Emma', last: 'Wilson', dob: '2014-08-22', gender: 'FEMALE', grade: 'Grade 5', room: 'Room 201' },
    { code: '06204', first: 'Bryan', last: 'Williams', dob: '2014-02-10', gender: 'MALE', grade: 'Grade 5', room: 'Room 201' },
  ];

  for (const s of studentList) {
    const sUserId = crypto.randomUUID();
    const sEmail = `${s.code.toLowerCase()}@student.afrotech.edu`;
    await query(
      `INSERT INTO users (id, email, "passwordHash", role, "accountStatus", "isEmailVerified", "emailVerifiedAt", "termsAccepted", "termsAcceptedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, '', 'STUDENT', 'ACTIVE', true, NOW(), true, NOW(), NOW(), NOW())`,
      [sUserId, sEmail]
    );
    await query(
      `INSERT INTO user_preferences (id, "userId", "pushNotificationsEnabled", "soundEnabled", "darkModeEnabled", "autoSyncEnabled", "createdAt", "updatedAt")
       VALUES ($1, $2, true, true, false, true, NOW(), NOW())`,
      [crypto.randomUUID(), sUserId]
    );
    await query(
      `INSERT INTO students (id, "userId", "studentCode", "firstName", "lastName", "dateOfBirth", gender, grade, room, "accessPinHash", "primaryTeacherId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [crypto.randomUUID(), sUserId, s.code, s.first, s.last, s.dob, s.gender, s.grade, s.room, pinHash, primaryTeacherId]
    );
  }
  logSuccess(`3 prototype students seeded and assigned to Teacher Profile.`);

  logStep('5.1', 'Student Login via Student ID [06201] and PIN [1234]');
  const studentLoginRes = await requestJson(`${BASE_URL}/api/auth/student/login`, {
    method: 'POST',
    body: JSON.stringify({ studentCode: '06201', pin: '1234' }),
  });
  if (studentLoginRes.status !== 200) throw new Error(`Student login failed: ${JSON.stringify(studentLoginRes.data)}`);
  logSuccess(`Student [Divine Ekubor - 06201] logged in successfully! Role: ${studentLoginRes.data.user.role}`);
  
  const studentAccessToken = studentLoginRes.data.tokens.accessToken;

  logStep('5.2', 'Student Profile Verification (/api/auth/me)');
  const studentMeRes = await requestJson(`${BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${studentAccessToken}` },
  });
  if (studentMeRes.status !== 200) throw new Error(`Student /api/auth/me failed: ${JSON.stringify(studentMeRes.data)}`);
  logSuccess(`Student profile verified: ${studentMeRes.data.profile.fullName} | Grade: ${studentMeRes.data.profile.grade} | Room: ${studentMeRes.data.profile.room}`);

  logStep('5.3', 'Negative Test: Invalid PIN for Student [06201]');
  const studentBadPin = await requestJson(`${BASE_URL}/api/auth/student/login`, {
    method: 'POST',
    body: JSON.stringify({ studentCode: '06201', pin: '0000' }),
  });
  if (studentBadPin.status !== 401) throw new Error(`Expected 401 for bad PIN, got: ${studentBadPin.status}`);
  logSuccess(`Invalid PIN correctly rejected with 401 Unauthorized.`);

  // ==========================================
  // PART 6: MULTI-CHILD PARENT ROSTERING
  // ==========================================
  banner('PARENT MULTI-CHILD ROSTERING (LINKING STUDENTS)');

  logStep('6.1', 'Parent links 1st Child [Emma Wilson - 06202]');
  const linkChild1 = await requestJson(`${BASE_URL}/api/parents/students/link`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeParentToken}` },
    body: JSON.stringify({
      studentCode: '06202',
      relationshipType: 'Mother',
      isPrimaryContact: true,
    }),
  });
  if (linkChild1.status !== 201) throw new Error(`Link child 1 failed: ${JSON.stringify(linkChild1.data)}`);
  logSuccess(`Linked child: ${linkChild1.data.student.firstName} ${linkChild1.data.student.lastName} [06202]`);

  logStep('6.2', 'Parent links 2nd Child [Bryan Williams - 06204]');
  const linkChild2 = await requestJson(`${BASE_URL}/api/parents/students/link`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeParentToken}` },
    body: JSON.stringify({
      studentCode: '06204',
      relationshipType: 'Guardian',
      isPrimaryContact: false,
    }),
  });
  if (linkChild2.status !== 201) throw new Error(`Link child 2 failed: ${JSON.stringify(linkChild2.data)}`);
  logSuccess(`Linked child: ${linkChild2.data.student.firstName} ${linkChild2.data.student.lastName} [06204]`);

  logStep('6.3', 'Negative Test: Prevent duplicate linking of same child');
  const dupLink = await requestJson(`${BASE_URL}/api/parents/students/link`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeParentToken}` },
    body: JSON.stringify({ studentCode: '06202' }),
  });
  if (dupLink.status !== 409) throw new Error(`Expected 409 Conflict for duplicate link, got: ${dupLink.status}`);
  logSuccess(`Duplicate linking correctly rejected with 409 Conflict.`);

  logStep('6.4', 'Parent fetches all linked children roster (/api/parents/students)');
  const linkedRoster = await requestJson(`${BASE_URL}/api/parents/students`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${activeParentToken}` },
  });
  if (linkedRoster.status !== 200) throw new Error(`Get linked students failed: ${JSON.stringify(linkedRoster.data)}`);
  logSuccess(`Parent has ${linkedRoster.data.length} linked children: ${linkedRoster.data.map(c => `${c.student.fullName} [${c.student.studentCode}]`).join(', ')}`);

  // ==========================================
  // PART 7: USER PREFERENCES FLOW
  // ==========================================
  banner('USER PREFERENCES (DARK MODE, NOTIFICATIONS, SOUND)');

  logStep('7.1', 'Fetch default preferences (/api/users/preferences)');
  const getPrefRes = await requestJson(`${BASE_URL}/api/users/preferences`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${activeParentToken}` },
  });
  if (getPrefRes.status !== 200) throw new Error(`Get preferences failed: ${JSON.stringify(getPrefRes.data)}`);
  logSuccess(`Default preferences: Push=${getPrefRes.data.pushNotificationsEnabled}, Sound=${getPrefRes.data.soundEnabled}, DarkMode=${getPrefRes.data.darkModeEnabled}`);

  logStep('7.2', 'Update preferences to Dark Mode & muted sound');
  const patchPrefRes = await requestJson(`${BASE_URL}/api/users/preferences`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${activeParentToken}` },
    body: JSON.stringify({
      darkModeEnabled: true,
      soundEnabled: false,
    }),
  });
  if (patchPrefRes.status !== 200) throw new Error(`Patch preferences failed: ${JSON.stringify(patchPrefRes.data)}`);

  logSuccess(`Updated preferences: DarkMode=${patchPrefRes.data.darkModeEnabled}, Sound=${patchPrefRes.data.soundEnabled}`);

  // ==========================================
  // PART 8: FINAL DATABASE INTEGRITY REPORT
  // ==========================================
  banner('FINAL DATABASE & SECURITY REPORT');


  const finalUsers = await query(`
    SELECT email, role, "accountStatus", "isEmailVerified", "emailVerifiedAt" 
    FROM users ORDER BY role
  `);

  console.log(`Total Active Users in Database: ${finalUsers.rows.length}`);
  console.table(finalUsers.rows);

  const tokensCount = await query(`SELECT count(*)::int as count FROM refresh_tokens`);
  const codesCount = await query(`SELECT count(*)::int as count FROM verification_codes`);
  console.log(`Total Verification Codes Logged: ${codesCount.rows[0].count}`);
  console.log(`Active Refresh Tokens in DB:    ${tokensCount.rows[0].count}\n`);

  console.log(`${colors.green}${colors.bright}ALL 4 PERSONAS (PARENT, TEACHER, ADMIN, STUDENT) SUCCESSFULLY TESTED THROUGH COMPLETE AUTH LIFECYCLES!${colors.reset}`);


  await pool.end();
}

runAllRolesFlow().catch(async (err) => {
  console.error(`\n${colors.red}${colors.bright}SIMULATION RUNTIME ERROR:${colors.reset}`, err);
  await pool.end().catch(() => {});
  process.exit(1);
});
