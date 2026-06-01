const db = require('../config/database');

exports.getAllUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, raw_password, full_name, bio, created_at,
        (SELECT COUNT(*) FROM posts WHERE user_id = users.id)::int AS post_count,
        (SELECT COUNT(*) FROM followers WHERE following_id = users.id)::int AS follower_count,
        (SELECT COUNT(*) FROM followers WHERE follower_id = users.id)::int AS following_count
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({ users: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
