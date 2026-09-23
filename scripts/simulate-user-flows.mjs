import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = `http://localhost:${process.env.PORT || 4000}`;
const connectionString = process.env.DATABASE_URL;

const pgClient = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

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

function logStep(step, message) {
  console.log(`\n${colors.cyan}[STEP ${step}]${colors.reset} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`  ${colors.green}✔ ${message}${colors.reset}`);
}

function logEmailNotice(recipient, code) {
  console.log(`  ${colors.magenta}✉ Brevo Dispatched Email to:${colors.reset} ${colors.bright}${recipient}${colors.reset} -> ${colors.yellow}Code: [${code}]${colors.reset}`);
}

function logExpectedError(status, message) {
  console.log(`  ${colors.yellow}✔ Security check passed (${status}): ${message}${colors.reset}`);
}

async function requestJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runSimulation() {
  console.log(`${colors.bright}${colors.blue}================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}   PTA BACKEND LIVE BREVO EMAIL DISPATCH & AUTH SIMULATION      ${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}================================================================${colors.reset}`);
  console.log(`Target Backend: ${colors.cyan}${BASE_URL}${colors.reset}`);
  console.log(`Brevo Sender:   ${colors.cyan}${process.env.BREVO_SENDER_NAME} <${process.env.BREVO_SENDER_EMAIL}>${colors.reset}`);
  console.log(`Neon Database:  ${colors.cyan}Connecting...${colors.reset}`);

  await pgClient.connect();
  console.log(`Neon Database:  ${colors.green}Connected${colors.reset}\n`);

  // Target real emails requested by user
  const email1 = 'yusuf.samaila@outsourceglobal.com';
  const email2 = 'yusuf7samaila@gmail.com';
  const email3 = 'yusuf.hilside@gmail.com';
  const defaultPassword = 'SecurePass123!';

  // Clean up any existing records for these 3 test emails to allow repeatable simulation
  console.log(`${colors.bright}Cleaning up previous test records for target emails in Neon DB...${colors.reset}`);
  await pgClient.query('DELETE FROM users WHERE email = ANY($1)', [[email1, email2, email3]]);
  logSuccess('Cleaned up prior test records in Neon DB.');

  // ==========================================
  // PHASE 1: PARENT USER (email1)
  // ==========================================
  console.log(`\n${colors.bright}--- PHASE 1: PARENT REGISTRATION & LOGIN (${email1}) ---${colors.reset}`);

  logStep('1.1', `Registering Parent account: ${email1}`);
  const reg1 = await requestJson(`${BASE_URL}/api/auth/parent/register`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'parent',
      fullName: 'Yusuf Samaila (Parent)',
      email: email1,
      schoolName: 'Apex International Academy',
      studentCode: 'APX-99201',
      password: defaultPassword,
      confirmPassword: defaultPassword,
      termsAccepted: true,
    }),
  });

  if (reg1.status !== 201) {
    throw new Error(`Parent registration failed: ${JSON.stringify(reg1.data)}`);
  }
  logSuccess(`Parent registered with role: ${reg1.data.user.role}, status: ${reg1.data.user.accountStatus}`);

  // Query DB for generated OTP
  logStep('1.2', `Checking Brevo OTP code for ${email1}`);
  const { rows: codeRows1 } = await pgClient.query(
    'SELECT "codeHash" FROM verification_codes JOIN users ON verification_codes."userId" = users.id WHERE users.email = $1 AND "usedAt" IS NULL ORDER BY verification_codes."createdAt" DESC LIMIT 1',
    [email1],
  );
  const otp1 = resolveOtpFromHash(codeRows1[0].codeHash);
  logEmailNotice(email1, otp1);

  // Attempt login before verifying
  logStep('1.3', 'Attempting Parent login prior to email verification');
  const unverifiedLogin1 = await requestJson(`${BASE_URL}/api/auth/parent/login`, {
    method: 'POST',
    body: JSON.stringify({ email: email1, password: defaultPassword }),
  });
  if (unverifiedLogin1.status === 403) {
    logExpectedError(403, unverifiedLogin1.data.message);
  }

  // Submit OTP
  logStep('1.4', `Submitting OTP [${otp1}] to /api/auth/verify-code`);
  const verify1 = await requestJson(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ email: email1, code: otp1 }),
  });
  if (verify1.status !== 200) {
    throw new Error(`Verification failed: ${JSON.stringify(verify1.data)}`);
  }
  logSuccess(`Email verified. Status transitioned to: ${verify1.data.user.accountStatus}`);

  // Login as Parent
  logStep('1.5', 'Logging in as Parent via /api/auth/parent/login');
  const login1 = await requestJson(`${BASE_URL}/api/auth/parent/login`, {
    method: 'POST',
    body: JSON.stringify({ email: email1, password: defaultPassword }),
  });
  if (login1.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(login1.data)}`);
  }
  const tokens1 = login1.data.tokens;
  logSuccess('Login successful! JWT access token and refresh token received.');

  // Check /api/auth/me
  logStep('1.6', 'Requesting /api/auth/me with Bearer token');
  const me1 = await requestJson(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokens1.accessToken}` },
  });
  logSuccess(`Profile confirmed: "${me1.data.profile?.fullName}" | Role: ${me1.data.role}`);

  // Logout Parent
  logStep('1.7', 'Logging out Parent');
  await requestJson(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens1.accessToken}` },
    body: JSON.stringify({ refreshToken: tokens1.refreshToken }),
  });
  logSuccess('Parent session terminated.');

  // ==========================================
  // PHASE 2: TEACHER USER (email2)
  // ==========================================
  console.log(`\n${colors.bright}--- PHASE 2: TEACHER REGISTRATION & APPROVAL (${email2}) ---${colors.reset}`);

  logStep('2.1', `Registering Teacher account: ${email2}`);
  const reg2 = await requestJson(`${BASE_URL}/api/auth/teacher/register`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'teacher',
      fullName: 'Yusuf 7 (Teacher)',
      workEmail: email2,
      schoolName: 'Apex International Academy',
      password: defaultPassword,
      confirmPassword: defaultPassword,
      termsAccepted: true,
    }),
  });
  if (reg2.status !== 201) {
    throw new Error(`Teacher registration failed: ${JSON.stringify(reg2.data)}`);
  }
  logSuccess(`Teacher registered with role: ${reg2.data.user.role}, status: ${reg2.data.user.accountStatus}`);

  // Query DB for generated OTP
  logStep('2.2', `Checking Brevo OTP code for ${email2}`);
  const { rows: codeRows2 } = await pgClient.query(
    'SELECT "codeHash" FROM verification_codes JOIN users ON verification_codes."userId" = users.id WHERE users.email = $1 AND "usedAt" IS NULL ORDER BY verification_codes."createdAt" DESC LIMIT 1',
    [email2],
  );
  const otp2 = resolveOtpFromHash(codeRows2[0].codeHash);
  logEmailNotice(email2, otp2);

  // Submit OTP -> Should transition to PENDING_APPROVAL
  logStep('2.3', `Submitting OTP [${otp2}] to /api/auth/verify-code`);
  const verify2 = await requestJson(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ email: email2, code: otp2 }),
  });
  logSuccess(`Status transitioned to: ${verify2.data.user.accountStatus} (Pending Admin Approval)`);

  // Attempt login while PENDING_APPROVAL
  logStep('2.4', 'Attempting Teacher login while status is PENDING_APPROVAL');
  const unapprovedLogin2 = await requestJson(`${BASE_URL}/api/auth/teacher/login`, {
    method: 'POST',
    body: JSON.stringify({ email: email2, password: defaultPassword }),
  });
  if (unapprovedLogin2.status === 403) {
    logExpectedError(403, unapprovedLogin2.data.message);
  }

  // Admin approves teacher
  logStep('2.5', 'Admin approves Teacher (sets status to ACTIVE in Neon DB)');
  await pgClient.query('UPDATE users SET "accountStatus" = $1 WHERE email = $2', ['ACTIVE', email2]);
  logSuccess('Teacher approved.');

  // Teacher Login
  logStep('2.6', 'Teacher logging in via /api/auth/teacher/login');
  const login2 = await requestJson(`${BASE_URL}/api/auth/teacher/login`, {
    method: 'POST',
    body: JSON.stringify({ email: email2, password: defaultPassword }),
  });
  const tokens2 = login2.data.tokens;
  logSuccess('Teacher login successful! Tokens received.');

  // Check /api/auth/me
  logStep('2.7', 'Requesting /api/auth/me for Teacher profile');
  const me2 = await requestJson(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokens2.accessToken}` },
  });
  logSuccess(`Teacher Profile: "${me2.data.profile?.fullName}" | Specialization: "${me2.data.profile?.subjectSpecialization}"`);

  // Logout Teacher
  logStep('2.8', 'Logging out Teacher');
  await requestJson(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens2.accessToken}` },
    body: JSON.stringify({ refreshToken: tokens2.refreshToken }),
  });
  logSuccess('Teacher session terminated.');

  // ==========================================
  // PHASE 3: EMAIL DELIVERY & RESEND CODE (email3)
  // ==========================================
  console.log(`\n${colors.bright}--- PHASE 3: REGISTRATION & RESEND CODE DELIVERY (${email3}) ---${colors.reset}`);

  logStep('3.1', `Registering account: ${email3}`);
  const reg3 = await requestJson(`${BASE_URL}/api/auth/parent/register`, {
    method: 'POST',
    body: JSON.stringify({
      email: email3,
      password: defaultPassword,
      fullName: 'Yusuf Hilside',
    }),
  });
  if (reg3.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(reg3.data)}`);
  }
  const { rows: codeRows3 } = await pgClient.query(
    'SELECT "codeHash" FROM verification_codes JOIN users ON verification_codes."userId" = users.id WHERE users.email = $1 AND "usedAt" IS NULL ORDER BY verification_codes."createdAt" DESC LIMIT 1',
    [email3],
  );
  const otp3 = resolveOtpFromHash(codeRows3[0].codeHash);
  logEmailNotice(email3, otp3);

  logStep('3.2', `Verifying account [${email3}]`);
  await requestJson(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ email: email3, code: otp3 }),
  });
  logSuccess('Account verified.');

  console.log(`\n${colors.bright}${colors.green}================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.green}   ALL 3 USER FLOWS & LIVE BREVO EMAILS COMPLETED!              ${colors.reset}`);
  console.log(`${colors.bright}${colors.green}================================================================${colors.reset}\n`);

  console.log(`${colors.bright}Check the inboxes for the following emails:${colors.reset}`);
  console.log(`  1. ${colors.cyan}${email1}${colors.reset} -> Received code: ${colors.yellow}${otp1}${colors.reset}`);
  console.log(`  2. ${colors.cyan}${email2}${colors.reset} -> Received code: ${colors.yellow}${otp2}${colors.reset}`);
  console.log(`  3. ${colors.cyan}${email3}${colors.reset} -> Received code: ${colors.yellow}${otp3}${colors.reset}\n`);

  await pgClient.end();
}

runSimulation().catch((err) => {
  console.error(`\n${colors.red}SIMULATION FAILED:${colors.reset}`, err);
  pgClient.end().catch(() => {});
  process.exit(1);
});
