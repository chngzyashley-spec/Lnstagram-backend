const config = require('../config');

/**
 * Convert a relative upload path to a full URL pointing to the backend.
 * E.g. '/uploads/abc.jpg' → 'https://lnstagram-backend.onrender.com/uploads/abc.jpg'
 * Cloudinary URLs (http/https) are returned as-is.
 */
function makeImageUrl(path) {
  if (!path) return path;
  // Already a full URL (Cloudinary, external)
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // Relative upload path
  if (path.startsWith('/uploads/')) {
    return config.backendUrl + path;
  }
  return path;
}

/**
 * Transform image URLs in an object or array recursively.
 * Looks for fields: image_url, image_urls, avatar_url
 */
function fixImageUrls(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(fixImageUrls);

  const result = { ...obj };
  if (result.image_url) result.image_url = makeImageUrl(result.image_url);
  if (result.image_urls) result.image_urls = result.image_urls.map(makeImageUrl);
  if (result.avatar_url) result.avatar_url = makeImageUrl(result.avatar_url);
  if (result.user && typeof result.user === 'object') result.user = fixImageUrls(result.user);
  if (result.post) result.post = fixImageUrls(result.post);
  if (result.posts) result.posts = result.posts.map(fixImageUrls);
  if (result.users) result.users = result.users.map(fixImageUrls);

  return result;
}

module.exports = { makeImageUrl, fixImageUrls };
