const validator = require('validator');
const db = require('../config/database');
const { cropImage } = require('../utils/imageProcessor');
const { fixImageUrls } = require('../utils/urlHelper');

exports.createPost = async (req, res) => {
  try {
    const { caption } = req.body;
    const userId = req.user.id;

    const { crop } = req.body;
    const aspectRatio = ['square', 'landscape', 'portrait'].includes(crop) ? crop : 'square';
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    if (caption && !validator.isLength(caption, { max: 2200 })) {
      return res.status(400).json({ error: 'Caption must be under 2200 characters.' });
    }

    // Crop images to selected aspect ratio
    await Promise.all(files.map((f) => cropImage(f.path, aspectRatio)));

    const imageUrls = files.map((file) => {
      if (file.path.startsWith('/')) {
        // Local disk storage - convert absolute path to relative URL
        return '/uploads/' + file.filename;
      }
      return file.path; // Cloudinary already returns a URL
    });

    const result = await db.query(
      `INSERT INTO posts (user_id, image_url, image_urls, caption, aspect_ratio)
       VALUES ($1, $2, $3::text[], $4, $5)
       RETURNING id, user_id, image_url, image_urls, caption, aspect_ratio, created_at`,
      [userId, imageUrls[0], imageUrls, caption || null, aspectRatio]
    );

    const post = result.rows[0];

    // Fetch user info
    const userResult = await db.query(
      'SELECT id, username, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    res.status(201).json({
      post: fixImageUrls({
        ...post,
        user: userResult.rows[0],
        like_count: 0,
        comment_count: 0,
        is_liked: false,
      }),
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { cursor, limit: rawLimit } = req.query;

    const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 50);

    // Build parameterized query
    let paramIdx = 1;
    const paramValues = [];
    const userIdParam = userId || null;

    let finalQuery = `
      SELECT p.id, p.user_id, p.image_url, p.image_urls, p.caption, p.aspect_ratio, p.created_at,
        u.username, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id)::int AS like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comment_count,
        EXISTS(
          SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1
        ) AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
    `;
    paramValues.push(userIdParam);
    paramIdx = 2;

    if (cursor) {
      finalQuery += ` WHERE p.created_at < $${paramIdx}`;
      paramValues.push(cursor);
      paramIdx++;
    }

    finalQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIdx}`;
    paramValues.push(limit + 1);

    const result = await db.query(finalQuery, paramValues);

    const hasMore = result.rows.length > limit;
    const posts = hasMore ? result.rows.slice(0, limit) : result.rows;

    const formattedPosts = posts.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      image_url: p.image_url,
      image_urls: p.image_urls || [p.image_url],
      caption: p.caption,
      aspect_ratio: p.aspect_ratio || 'square',
      created_at: p.created_at,
      like_count: p.like_count,
      comment_count: p.comment_count,
      is_liked: p.is_liked,
      user: {
        id: p.user_id,
        username: p.username,
        avatar_url: p.avatar_url,
      },
    }));

    res.json({
      posts: fixImageUrls(formattedPosts),
      next_cursor: hasMore ? posts[posts.length - 1].created_at : null,
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getPost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    const result = await db.query(
      `      SELECT p.id, p.user_id, p.image_url, p.image_urls, p.caption, p.aspect_ratio, p.created_at,
        u.username, u.avatar_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id)::int AS like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comment_count
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const post = result.rows[0];

    let isLiked = false;
    if (userId) {
      const likeCheck = await db.query(
        'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
        [userId, id]
      );
      isLiked = likeCheck.rows.length > 0;
    }

    res.json({
      post: fixImageUrls({
        ...post,
        image_urls: post.image_urls || [post.image_url],
        is_liked: isLiked,
        user: {
          id: post.user_id,
          username: post.username,
          avatar_url: post.avatar_url,
        },
      }),
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or not authorized.' });
    }

    res.json({ message: 'Post deleted successfully.' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getUserPosts = async (req, res) => {
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
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id)::int AS like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id)::int AS comment_count,
        EXISTS(
          SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2
        ) AS is_liked
      FROM posts p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT 30`,
      [targetId, userId || null]
    );

    const posts = fixImageUrls(result.rows.map((p) => ({
      ...p,
      image_urls: p.image_urls || [p.image_url],
    })));

    res.json({ posts });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};
