require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET is required'); })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || (() => {
    console.warn('\u26a0\ufe0f  BACKEND_URL not set - using default. Set BACKEND_URL on Render.');
    return 'https://lnstagram-backend.onrender.com';
  })(),
};
