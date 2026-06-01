const db = require('../config/database');
const { fixImageUrls } = require('../utils/urlHelper');
const { cropImage } = require('../utils/imageProcessor');

exports.getStories = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT s.id, s.image_url, s.created_at,
        u.id AS user_id, u.username, u.avatar_url
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.created_at > NOW() - INTERVAL '24 hours'
         AND (s.user_id = $1 OR s.user_id IN (
           SELECT following_id FROM followers WHERE follower_id = $1
         ))
       ORDER BY u.username, s.created_at DESC`,
      [userId]
    );

    // Group stories by user
    const grouped = {};
    const seen = new Set();
    for (const s of fixImageUrls(result.rows)) {
      if (!grouped[s.user_id]) {
        grouped[s.user_id] = {
          user_id: s.user_id,
          username: s.username,
          avatar_url: s.avatar_url,
          stories: [],
          latest_timestamp: s.created_at,
        };
      }
      if (!seen.has(s.id)) {
        grouped[s.user_id].stories.push(s);
        seen.add(s.id);
      }
      if (s.created_at > grouped[s.user_id].latest_timestamp) {
        grouped[s.user_id].latest_timestamp = s.created_at;
      }
    }

    // Sort: own stories first, then by latest timestamp
    const users = Object.values(grouped).sort((a, b) => {
      if (a.user_id === userId) return -1;
      if (b.user_id === userId) return 1;
      return new Date(b.latest_timestamp) - new Date(a.latest_timestamp);
    });

    res.json({ users });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.createStory = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'An image is required.' });
    }

    await cropImage(file.path, 'portrait');

    const imageUrl = file.path.startsWith('/') && !file.path.startsWith('//')
      ? '/uploads/' + file.filename
      : file.path;

    const result = await db.query(
      `INSERT INTO stories (user_id, image_url) VALUES ($1, $2)
       RETURNING id, image_url, created_at`,
      [userId, imageUrl]
    );

    res.status(201).json({
      story: fixImageUrls(result.rows[0]),
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.deleteStory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found.' });
    }

    res.json({ message: 'Story deleted.' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
