const { Router } = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { generalLimiter, authLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

// Controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const likeController = require('../controllers/likeController');
const commentController = require('../controllers/commentController');
const notificationController = require('../controllers/notificationController');
const adminController = require('../controllers/adminController');

const router = Router();

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth routes
router.post('/auth/register', authLimiter, authController.register);
router.post('/auth/login', authLimiter, authController.login);
router.get('/auth/me', authenticate, authController.getMe);

// User routes
router.get('/users/search', optionalAuth, userController.searchUsers);
router.get('/users/:username', optionalAuth, userController.getProfile);
router.put('/users/profile', authenticate, upload.single('avatar'), userController.editProfile);
router.get('/users/:username/followers', optionalAuth, userController.getFollowers);
router.get('/users/:username/following', optionalAuth, userController.getFollowing);

// Follow routes
router.post('/follow/:id', authenticate, userController.followUser);
router.delete('/follow/:id', authenticate, userController.unfollowUser);

// Post routes
router.get('/posts', optionalAuth, postController.getFeed);
router.post('/posts', authenticate, upload.array('images', 10), postController.createPost);
router.get('/posts/:id', optionalAuth, postController.getPost);
router.delete('/posts/:id', authenticate, postController.deletePost);
router.get('/users/:username/posts', optionalAuth, postController.getUserPosts);

// Like routes
router.post('/posts/:id/like', authenticate, likeController.likePost);
router.delete('/posts/:id/like', authenticate, likeController.unlikePost);

// Comment routes
router.get('/posts/:id/comments', commentController.getComments);
router.post('/posts/:id/comments', authenticate, commentController.createComment);
router.delete('/comments/:id', authenticate, commentController.deleteComment);

// Notification routes
router.get('/notifications', authenticate, notificationController.getNotifications);
router.get('/notifications/count', authenticate, notificationController.getUnreadCount);
router.put('/notifications/:id/read', authenticate, notificationController.markRead);
router.put('/notifications/read-all', authenticate, notificationController.markAllRead);

// Admin routes (restricted to ashley_chng)
router.get('/admin/users', authenticate, (req, res, next) => {
  if (req.user.username !== 'ashley_chng') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}, adminController.getAllUsers);

module.exports = router;
