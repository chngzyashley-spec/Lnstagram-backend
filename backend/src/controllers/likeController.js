const db = require('../config/database');

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
