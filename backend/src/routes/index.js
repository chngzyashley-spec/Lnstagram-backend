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
const storyController = require('../controllers/storyController');
const messageController = require('../controllers/messageController');
const repostController = require('../controllers/repostController');
const settingsController = require('../controllers/settingsController');
const blockController = require('../controllers/blockController');

const router = Router();

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth routes
router.post('/auth/register', authLimiter, authController.register);
router.post('/auth/login', authLimiter, authController.login);
router.get('/auth/me', authenticate, authController.getMe);

// User routes
router.get('/users/search', optionalAuth, userController.searchUsers);
router.put('/users/profile', authenticate, upload.single('avatar'), userController.editProfile);

// Settings routes (must be before /:username to avoid being caught by param)
router.get('/users/settings', authenticate, settingsController.getSettings);
router.put('/users/settings', authenticate, settingsController.updateSettings);

// Liked & reposted posts (must be before /:username)
router.get('/users/:username/likes', optionalAuth, likeController.getLikedPosts);
router.get('/users/:username/reposts', optionalAuth, repostController.getUserReposts);

router.get('/users/:username', optionalAuth, userController.getProfile);
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

// Story routes
router.get('/stories', authenticate, storyController.getStories);
router.post('/stories', authenticate, upload.single('image'), storyController.createStory);
router.delete('/stories/:id', authenticate, storyController.deleteStory);

// Message routes
router.get('/messages', authenticate, messageController.getInbox);
router.get('/messages/:userId', authenticate, messageController.getConversation);
router.post('/messages/:userId', authenticate, messageController.sendMessage);
router.put('/messages/:userId/read', authenticate, messageController.markRead);

// Block routes (any authenticated user can block/unblock any other user)
router.post('/users/:id/block', authenticate, blockController.blockUser);
router.post('/users/:id/unblock', authenticate, blockController.unblockUser);

// Repost routes
router.post('/posts/:id/repost', authenticate, repostController.repost);
router.delete('/posts/:id/repost', authenticate, repostController.unrepost);

// Admin routes (restricted to ashley_chng)
router.post('/admin/migrate', authenticate, async (req, res, next) => {
  if (req.user.username !== 'ashley_chng') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  try {
    const { runMigration } = require('../migrate');
    await runMigration();
    res.json({ message: 'Migration completed successfully.' });
  } catch (error) {
    console.error('Migration via API error:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

router.get('/admin/users', authenticate, (req, res, next) => {
  if (req.user.username !== 'ashley_chng') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}, adminController.getAllUsers);

router.delete('/admin/users/seed', authenticate, (req, res, next) => {
  if (req.user.username !== 'ashley_chng') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}, adminController.deleteSeedUsers);

router.post('/admin/users/:id/block', authenticate, (req, res, next) => {
  if (req.user.username !== 'ashley_chng') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}, adminController.blockUser);

router.post('/admin/users/:id/unblock', authenticate, (req, res, next) => {
  if (req.user.username !== 'ashley_chng') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}, adminController.unblockUser);

router.delete('/admin/users/:id', authenticate, (req, res, next) => {
  if (req.user.username !== 'ashley_chng') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}, adminController.deleteUser);

module.exports = router;
