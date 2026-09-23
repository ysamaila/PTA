import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  await client.connect();
  console.log('Connected to Neon PostgreSQL DB.');

  console.log('1. Altering users table (adding termsAccepted, termsAcceptedAt)...');
  await client.query(`
    ALTER TABLE "users" 
    ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  `);

  console.log('2. Altering parent_profiles table (adding schoolName, studentCode)...');
  await client.query(`
    ALTER TABLE "parent_profiles" 
    ADD COLUMN IF NOT EXISTS "schoolName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "studentCode" TEXT NOT NULL DEFAULT '';
  `);

  console.log('3. Altering teacher_profiles table (adding schoolName)...');
  await client.query(`
    ALTER TABLE "teacher_profiles" 
    ADD COLUMN IF NOT EXISTS "schoolName" TEXT NOT NULL DEFAULT '';
  `);

  console.log('4. Verifying added columns in Neon DB:');
  const res = await client.query(`
    SELECT table_name, column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name IN ('users', 'parent_profiles', 'teacher_profiles')
      AND column_name IN ('termsAccepted', 'termsAcceptedAt', 'schoolName', 'studentCode')
    ORDER BY table_name, column_name;
  `);
  console.table(res.rows);

  await client.end();
  console.log('Migration completed successfully in Neon DB!');
}

runMigration().catch(async (err) => {
  console.error('Migration failed:', err);
  await client.end().catch(() => {});
  process.exit(1);
});
