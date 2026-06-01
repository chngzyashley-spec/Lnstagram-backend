const db = require('../config/database');

exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Upsert: ensure settings row exists with defaults
    await db.query(
      `INSERT INTO user_settings (user_id, liked_posts_public, private_account, show_activity)
       VALUES ($1, TRUE, FALSE, TRUE)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const result = await db.query(
      'SELECT liked_posts_public, private_account, show_activity FROM user_settings WHERE user_id = $1',
      [userId]
    );

    res.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { liked_posts_public, private_account, show_activity } = req.body;

    // Build dynamic update for any setting field
    const setClauses = [];
    const values = [userId];
    let idx = 2;

    const allowedSettings = { liked_posts_public, private_account, show_activity };

    for (const [key, val] of Object.entries(allowedSettings)) {
      if (val !== undefined) {
        if (typeof val !== 'boolean') {
          return res.status(400).json({ error: `${key} must be a boolean.` });
        }
        setClauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid settings to update.' });
    }

    const result = await db.query(
      `INSERT INTO user_settings (user_id, ${setClauses.map((c, i) => c.split(' = ')[0]).join(', ')})
       VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (user_id)
       DO UPDATE SET ${setClauses.join(', ')}
       RETURNING liked_posts_public, private_account, show_activity`,
      values
    );

    res.json({ settings: result.rows[0] });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
