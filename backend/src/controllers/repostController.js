const db = require('../config/database');
const { fixImageUrls } = require('../utils/urlHelper');

exports.repost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    // Check post exists
    const postResult = await db.query('SELECT id, user_id FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Check if already reposted
    const existing = await db.query(
      'SELECT id FROM reposts WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already reposted.' });
    }

    await db.query(
      'INSERT INTO reposts (user_id, post_id) VALUES ($1, $2)',
      [userId, postId]
    );

    res.status(201).json({ message: 'Post reposted.' });
  } catch (error) {
    console.error('Repost error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.unrepost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM reposts WHERE user_id = $1 AND post_id = $2 RETURNING id',
      [userId, postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repost not found.' });
    }

    res.json({ message: 'Repost removed.' });
  } catch (error) {
    console.error('Unrepost error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getUserReposts = async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.user ? req.user.id : null;

    const userResult = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetId = userResult.rows[0].id;

    const result = await db.query(
      `SELECT p.id, p.user_id, p.image_url, p.image_urls, p.caption, p.aspect_ratio, p.created_at,
        u.username, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id)::int AS like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comment_count,
        r.created_at AS reposted_at,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS is_liked,
        EXISTS(SELECT 1 FROM reposts WHERE post_id = p.id AND user_id = $2) AS is_reposted
       FROM reposts r
       JOIN posts p ON r.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 30`,
      [targetId, userId || null]
    );

    const posts = result.rows.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      image_url: p.image_url,
      image_urls: p.image_urls || [p.image_url],
      caption: p.caption,
      aspect_ratio: p.aspect_ratio || 'square',
      created_at: p.created_at,
      reposted_at: p.reposted_at,
      like_count: p.like_count,
      comment_count: p.comment_count,
      is_liked: p.is_liked,
      is_reposted: p.is_reposted,
      is_repost: true,
      user: {
        id: p.user_id,
        username: p.username,
        avatar_url: p.avatar_url,
      },
    }));

    res.json({ posts: fixImageUrls(posts) });
  } catch (error) {
    console.error('Get user reposts error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
