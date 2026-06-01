const validator = require('validator');
const db = require('../config/database');
const { cropImage } = require('../utils/imageProcessor');

exports.getProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.bio, u.avatar_url, u.created_at,
        (SELECT COUNT(*) FROM followers WHERE following_id = u.id)::int AS follower_count,
        (SELECT COUNT(*) FROM followers WHERE follower_id = u.id)::int AS following_count,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.id)::int AS post_count
       FROM users u WHERE u.username = $1`,
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];

    // Check if current user follows this profile
    let isFollowing = false;
    if (req.user && req.user.id !== user.id) {
      const followCheck = await db.query(
        'SELECT id FROM followers WHERE follower_id = $1 AND following_id = $2',
        [req.user.id, user.id]
      );
      isFollowing = followCheck.rows.length > 0;
    }

    res.json({ user: { ...user, is_following: isFollowing } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.editProfile = async (req, res) => {
  try {
    const { full_name, bio, username } = req.body;
    const userId = req.user.id;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      if (!validator.isLength(full_name, { max: 100 })) {
        return res.status(400).json({ error: 'Full name must be under 100 characters.' });
      }
      updates.push(`full_name = $${paramCount++}`);
      values.push(full_name);
    }

    if (bio !== undefined) {
      if (!validator.isLength(bio, { max: 500 })) {
        return res.status(400).json({ error: 'Bio must be under 500 characters.' });
      }
      updates.push(`bio = $${paramCount++}`);
      values.push(bio);
    }

    if (username !== undefined) {
      if (!validator.isLength(username, { min: 3, max: 30 })) {
        return res.status(400).json({ error: 'Username must be 3-30 characters.' });
      }
      // Check if username is taken
      const existing = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.toLowerCase(), userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username already taken.' });
      }
      updates.push(`username = $${paramCount++}`);
      values.push(username.toLowerCase());
    }

    // Handle avatar upload
    if (req.file) {
      // Crop to 1080x1080 square (avatars always square)
      await cropImage(req.file.path, 'square');
      // Convert absolute local path to relative URL
      const avatarUrl = req.file.path.startsWith('/') && !req.file.path.startsWith('//')
        ? '/uploads/' + req.file.filename
        : req.file.path;
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatarUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(userId);

    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING id, username, email, full_name, bio, avatar_url, created_at`,
      values
    );

    const user = result.rows[0];

    // Get counts
    const counts = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM followers WHERE following_id = $1)::int AS follower_count,
        (SELECT COUNT(*) FROM followers WHERE follower_id = $1)::int AS following_count,
        (SELECT COUNT(*) FROM posts WHERE user_id = $1)::int AS post_count`,
      [userId]
    );

    res.json({ user: { ...user, ...counts.rows[0] } });
  } catch (error) {
    console.error('Edit profile error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 1) {
      return res.status(400).json({ error: 'Search query required.' });
    }

    const result = await db.query(
      `SELECT id, username, full_name, avatar_url
       FROM users
       WHERE username ILIKE $1 OR full_name ILIKE $1
       ORDER BY username
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.followUser = async (req, res) => {
  try {
    const { id: followingId } = req.params;
    const followerId = req.user.id;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    // Check if target exists
    const targetUser = await db.query('SELECT id, username FROM users WHERE id = $1', [followingId]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if already following
    const existing = await db.query(
      'SELECT id FROM followers WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already following this user.' });
    }

    await db.query(
      'INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)',
      [followerId, followingId]
    );

    // Create notification
    await db.query(
      `INSERT INTO notifications (recipient_id, actor_id, type)
       VALUES ($1, $2, 'follow')`,
      [followingId, followerId]
    );

    res.status(201).json({ message: 'Successfully followed user.' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const { id: followingId } = req.params;
    const followerId = req.user.id;

    const result = await db.query(
      'DELETE FROM followers WHERE follower_id = $1 AND following_id = $2 RETURNING id',
      [followerId, followingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not following this user.' });
    }

    res.json({ message: 'Successfully unfollowed user.' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getFollowers = async (req, res) => {
  try {
    const { username } = req.params;

    const userResult = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const result = await db.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url
       FROM followers f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [userResult.rows[0].id]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getFollowing = async (req, res) => {
  try {
    const { username } = req.params;

    const userResult = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const result = await db.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url
       FROM followers f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [userResult.rows[0].id]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
