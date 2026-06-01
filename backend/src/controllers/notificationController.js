const db = require('../config/database');
const { fixImageUrls } = require('../utils/urlHelper');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT n.id, n.type, n.read, n.post_id, n.comment_id, n.created_at,
        a.id AS actor_id, a.username AS actor_username, a.avatar_url AS actor_avatar
       FROM notifications n
       JOIN users a ON n.actor_id = a.id
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ notifications: fixImageUrls(result.rows) });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await db.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND recipient_id = $2',
      [id, userId]
    );

    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      'UPDATE notifications SET read = TRUE WHERE recipient_id = $1 AND read = FALSE',
      [userId]
    );

    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND read = FALSE',
      [userId]
    );

    res.json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
