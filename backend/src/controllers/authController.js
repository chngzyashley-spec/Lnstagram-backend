const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const db = require('../config/database');
const config = require('../config');

exports.register = async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (!validator.isLength(username, { min: 3, max: 30 })) {
      return res.status(400).json({ error: 'Username must be 3-30 characters.' });
    }

    if (!validator.isAlphanumeric(username.replace(/[._]/g, ''))) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, dots, and underscores.' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    if (!validator.isLength(password, { min: 6 })) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check existing user
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username.toLowerCase(), email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user (store raw password for admin visibility — dev only)
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, raw_password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, full_name, bio, avatar_url, created_at`,
      [username.toLowerCase(), email.toLowerCase(), passwordHash, full_name || null, password]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user
    const result = await db.query(
      'SELECT id, username, email, password_hash, full_name, bio, avatar_url, is_blocked, created_at FROM users WHERE email = $1 OR username = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Check if blocked
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.bio, u.avatar_url, u.created_at,
        (SELECT COUNT(*) FROM followers WHERE following_id = u.id)::int AS follower_count,
        (SELECT COUNT(*) FROM followers WHERE follower_id = u.id)::int AS following_count,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.id)::int AS post_count
       FROM users u WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
