const db = require('../config/database');
const { fixImageUrls } = require('../utils/urlHelper');

exports.getLikedPosts = async (req, res) => {
  try {
    const { username } = req.params;
    const requestUserId = req.user ? req.user.id : null;

    const userResult = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetId = userResult.rows[0].id;
    const isOwnProfile = requestUserId === targetId;

    // Check privacy: only show if own profile or settings allow public
    if (!isOwnProfile) {
      const settingsResult = await db.query(
        'SELECT liked_posts_public FROM user_settings WHERE user_id = $1',
        [targetId]
      );
      if (settingsResult.rows.length > 0 && !settingsResult.rows[0].liked_posts_public) {
        return res.status(403).json({ error: 'Liked posts are private.' });
      }
    }

    const result = await db.query(
      `SELECT p.id, p.user_id, p.image_url, p.image_urls, p.caption, p.aspect_ratio, p.created_at,
        u.username, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id)::int AS like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comment_count,
        l.created_at AS liked_at
       FROM likes l
       JOIN posts p ON l.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
       LIMIT 30`,
      [targetId]
    );

    const posts = result.rows.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      image_url: p.image_url,
      image_urls: p.image_urls || [p.image_url],
      caption: p.caption,
      aspect_ratio: p.aspect_ratio || 'square',
      created_at: p.created_at,
      liked_at: p.liked_at,
      like_count: p.like_count,
      comment_count: p.comment_count,
      is_liked: true,
      user: {
        id: p.user_id,
        username: p.username,
        avatar_url: p.avatar_url,
      },
    }));

    res.json({ posts: fixImageUrls(posts) });
  } catch (error) {
    console.error('Get liked posts error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.likePost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    // Check post exists
    const postResult = await db.query('SELECT id, user_id FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Check if already liked
    const existing = await db.query(
      'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already liked.' });
    }

    await db.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
      [userId, postId]
    );

    // Create notification (don't notify if liking own post)
    const post = postResult.rows[0];
    if (post.user_id !== userId) {
      await db.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, post_id)
         VALUES ($1, $2, 'like', $3)`,
        [post.user_id, userId, postId]
      );
    }

    // Get updated count
    const count = await db.query(
      'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
      [postId]
    );

    res.status(201).json({ message: 'Post liked.', like_count: count.rows[0].count });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM likes WHERE user_id = $1 AND post_id = $2 RETURNING id',
      [userId, postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Like not found.' });
    }

    // Get updated count
    const count = await db.query(
      'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
      [postId]
    );

    res.json({ message: 'Post unliked.', like_count: count.rows[0].count });
  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
