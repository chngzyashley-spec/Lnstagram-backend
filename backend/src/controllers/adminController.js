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

exports.deleteSeedUsers = async (req, res) => {
  try {
    const seedUsernames = ['john_doe', 'jane_smith', 'travel_with_mike', 'foodie_emma', 'alex_creates'];

    // Get seed user IDs
    const userResult = await db.query(
      `SELECT id, username FROM users WHERE username = ANY($1)`,
      [seedUsernames]
    );

    if (userResult.rows.length === 0) {
      return res.json({ message: 'No seed users found. Already cleaned up!' });
    }

    const seedIds = userResult.rows.map(r => r.id);
    const removedUsernames = userResult.rows.map(r => r.username);

    // Delete all related data for seed users
    await db.query('DELETE FROM notifications WHERE actor_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM notifications WHERE recipient_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM followers WHERE follower_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM followers WHERE following_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM comments WHERE user_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM likes WHERE user_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM reposts WHERE user_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM stories WHERE user_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM messages WHERE sender_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM messages WHERE recipient_id = ANY($1)', [seedIds]);
    await db.query('DELETE FROM posts WHERE user_id = ANY($1)', [seedIds]);

    // Finally delete the seed users
    await db.query('DELETE FROM users WHERE id = ANY($1)', [seedIds]);

    res.json({
      message: `Removed ${seedIds.length} seed users and all their data.`,
      removed: removedUsernames,
    });
  } catch (error) {
    console.error('Admin delete seed users error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
