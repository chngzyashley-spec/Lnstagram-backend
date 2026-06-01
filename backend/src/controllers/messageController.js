const db = require('../config/database');
const { fixImageUrls } = require('../utils/urlHelper');

exports.getInbox = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get the latest message for each conversation
    const result = await db.query(
      `SELECT DISTINCT ON (CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END)
        CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS partner_id,
        u.username, u.avatar_url,
        m.content AS last_message,
        m.created_at AS last_time,
        m.sender_id = $1 AS sent_by_me,
        COALESCE((SELECT COUNT(*) FROM messages
         WHERE sender_id = CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END
         AND recipient_id = $1 AND read = FALSE), 0)::int AS unread
       FROM messages m
       JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END
       WHERE $1 IN (m.sender_id, m.recipient_id)
       ORDER BY CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END, m.created_at DESC`,
      [userId]
    );

    res.json({ conversations: fixImageUrls(result.rows) });
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: partnerId } = req.params;

    const result = await db.query(
      `SELECT m.id, m.sender_id, m.recipient_id, m.content, m.read, m.created_at,
        u.username AS sender_username, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE (m.sender_id = $1 AND m.recipient_id = $2)
          OR (m.sender_id = $2 AND m.recipient_id = $1)
       ORDER BY m.created_at ASC
       LIMIT 100`,
      [userId, partnerId]
    );

    res.json({ messages: fixImageUrls(result.rows) });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { userId: recipientId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
    }

    const result = await db.query(
      `INSERT INTO messages (sender_id, recipient_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, recipient_id, content, read, created_at`,
      [senderId, recipientId, content.trim()]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userId: partnerId } = req.params;

    await db.query(
      `UPDATE messages SET read = TRUE
       WHERE sender_id = $1 AND recipient_id = $2 AND read = FALSE`,
      [partnerId, userId]
    );

    res.json({ message: 'Messages marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
