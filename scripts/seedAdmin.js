const User = require('../models/User');

/**
 * Ensure a default admin account exists for Docker / first-run demos.
 * Controlled by SEED_ADMIN=true (set in docker-compose).
 */
const seedAdmin = async () => {
  if (process.env.SEED_ADMIN !== 'true') return;

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@campustrace.local';
  const password = process.env.SEED_ADMIN_PASSWORD || '123456';
  const studentId = process.env.SEED_ADMIN_STUDENT_ID || 'ADMIN001';
  const name = process.env.SEED_ADMIN_NAME || 'Campus Admin';

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`✅ Seeded admin role on existing user: ${email}`);
    }
    return;
  }

  await User.create({
    name,
    email,
    studentId,
    password,
    role: 'admin',
  });

  console.log(`✅ Seeded admin account: ${email} / ${password}`);
};

module.exports = seedAdmin;
