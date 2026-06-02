const db = require('../config/database');

// Block a user (any authenticated user can block any other user)
exports.blockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { id: blockedId } = req.params;

    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself.' });
    }

    // Check blocked user exists
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [blockedId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if already blocked
    const existing = await db.query(
      'SELECT id FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User is already blocked.' });
    }

    // Remove follow relationship if it exists (both ways)
    await db.query(
      'DELETE FROM followers WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)',
      [blockerId, blockedId]
    );

    await db.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)',
      [blockerId, blockedId]
    );

    res.json({ message: `Blocked @${userResult.rows[0].username}.` });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// Unblock a user
exports.unblockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { id: blockedId } = req.params;

    const result = await db.query(
      'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2 RETURNING id',
      [blockerId, blockedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User is not blocked.' });
    }

    const usernameResult = await db.query('SELECT username FROM users WHERE id = $1', [blockedId]);

    res.json({ message: `Unblocked @${usernameResult.rows[0].username}.` });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// Check if req.user has blocked a given user
exports.hasBlocked = async (blockerId, targetId) => {
  const result = await db.query(
    'SELECT id FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, targetId]
  );
  return result.rows.length > 0;
};
