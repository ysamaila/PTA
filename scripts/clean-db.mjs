import pg from 'pg';
import 'dotenv/config';

const connectionString = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '');
const pool = new pg.Pool({ connectionString });

async function cleanDatabase() {
  console.log('Cleaning database...');
  
  await pool.query(`
    TRUNCATE TABLE 
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

  const counts = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM users) as users_count,
      (SELECT COUNT(*) FROM students) as students_count,
      (SELECT COUNT(*) FROM teacher_profiles) as teachers_count,
      (SELECT COUNT(*) FROM parent_profiles) as parents_count,
      (SELECT COUNT(*) FROM student_parent_links) as links_count,
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
