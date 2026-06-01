const validator = require('validator');
const db = require('../config/database');

exports.getComments = async (req, res) => {
  try {
    const { id: postId } = req.params;

    const result = await db.query(
      `SELECT c.id, c.content, c.created_at,
        u.id AS user_id, u.username, u.avatar_url
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT 100`,
      [postId]
    );

    res.json({ comments: result.rows });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !validator.isLength(content.trim(), { min: 1, max: 2200 })) {
      return res.status(400).json({ error: 'Comment must be 1-2200 characters.' });
    }

    // Check post exists
    const postResult = await db.query('SELECT id, user_id FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const result = await db.query(
      `INSERT INTO comments (user_id, post_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at, user_id`,
      [userId, postId, content.trim()]
    );

    const comment = result.rows[0];

    // Get user info
    const userResult = await db.query(
      'SELECT id, username, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    // Create notification (don't notify if commenting on own post)
    const post = postResult.rows[0];
    if (post.user_id !== userId) {
      await db.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id)
         VALUES ($1, $2, 'comment', $3, $4)`,
        [post.user_id, userId, postId, comment.id]
      );
    }

    res.status(201).json({
      comment: {
        ...comment,
        user: userResult.rows[0],
      },
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { id: commentId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [commentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or not authorized.' });
    }

    res.json({ message: 'Comment deleted.' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
