import pg from 'pg';
import 'dotenv/config';

const connectionString = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '');
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function query(text, params) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function cleanDatabase() {
  console.log('Cleaning database...');
  
  await query(`
    TRUNCATE TABLE 
      attendance_records,
      student_parent_links,
      user_preferences,
      verification_codes,
      refresh_tokens,
      students,
      teacher_profiles,
      parent_profiles,
      users
    CASCADE;
  `);

  const counts = await query(`
    SELECT 
      (SELECT COUNT(*) FROM users) as users_count,
      (SELECT COUNT(*) FROM students) as students_count,
      (SELECT COUNT(*) FROM teacher_profiles) as teachers_count,
      (SELECT COUNT(*) FROM parent_profiles) as parents_count,
      (SELECT COUNT(*) FROM student_parent_links) as links_count,
      (SELECT COUNT(*) FROM attendance_records) as attendance_count,
      (SELECT COUNT(*) FROM user_preferences) as preferences_count,
      (SELECT COUNT(*) FROM verification_codes) as codes_count,
      (SELECT COUNT(*) FROM refresh_tokens) as tokens_count;
  `);

  console.log('Database cleaned successfully. Table row counts:');
  console.log(counts.rows[0]);

  await pool.end();
}

cleanDatabase().catch(err => {
  console.error('Failed to clean database:', err);
  process.exit(1);
});
