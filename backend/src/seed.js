const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    const passwordHash = await bcrypt.hash('password123', 12);

    // Create users
    const users = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, bio, avatar_url) VALUES
       ('john_doe', 'john@example.com', $1, 'John Doe', 'Travel enthusiast | Photographer | Coffee lover', 'https://ui-avatars.com/api/?name=John+Doe&background=random&size=200'),
       ('jane_smith', 'jane@example.com', $1, 'Jane Smith', 'Digital creator. Capturing moments.', 'https://ui-avatars.com/api/?name=Jane+Smith&background=random&size=200'),
       ('travel_with_mike', 'mike@example.com', $1, 'Mike Johnson', 'Exploring the world one city at a time 🌍', 'https://ui-avatars.com/api/?name=Mike+Johnson&background=random&size=200'),
       ('foodie_emma', 'emma@example.com', $1, 'Emma Davis', 'Food photographer & recipe developer 🍳', 'https://ui-avatars.com/api/?name=Emma+Davis&background=random&size=200'),
       ('alex_creates', 'alex@example.com', $1, 'Alex Brown', 'Graphic designer & visual storyteller', 'https://ui-avatars.com/api/?name=Alex+Brown&background=random&size=200')
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username`,
      [passwordHash]
    );

    const userIds = {};
    users.rows.forEach((u) => {
      userIds[u.username] = u.id;
    });

    console.log('✅ Users created');

    // Create posts
    const postImages = [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800',
      'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
      'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=800',
      'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
    ];

    const captions = [
      'Chasing sunsets and good vibes 🌅',
      'Adventure awaits around every corner',
      'Nothing beats this view!',
      'Lost in the beauty of nature',
      'City lights and late nights 🌃',
      'Pasta perfection! Home-made and delicious 🍝',
      'Weekend vibes only ✨',
      'Golden hour magic in paradise',
      'Exploring new horizons',
      'Peaceful moments captured in time',
    ];

    const usernames = Object.keys(userIds);

    const posts = [];
    for (let i = 0; i < 10; i++) {
      const username = usernames[i % usernames.length];
      const result = await db.query(
        `INSERT INTO posts (user_id, image_url, caption)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userIds[username], postImages[i], captions[i]]
      );
      posts.push(result.rows[0].id);
    }

    console.log('✅ Posts created');

    // Create likes
    const likePairs = new Set();
    for (let i = 0; i < 25; i++) {
      const postIdx = Math.floor(Math.random() * posts.length);
      const userIdx = Math.floor(Math.random() * usernames.length);
      const key = `${usernames[userIdx]}-${posts[postIdx]}`;

      if (!likePairs.has(key)) {
        likePairs.add(key);
        try {
          await db.query(
            'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userIds[usernames[userIdx]], posts[postIdx]]
          );
        } catch (e) {
          // Ignore duplicates
        }
      }
    }

    console.log('✅ Likes created');

    // Create comments
    const commentTexts = [
      'Amazing shot! 🔥',
      'Love this so much!',
      'Beautiful capture!',
      'Where is this? Looks incredible!',
      'Goals! 🙌',
      'This is stunning!',
      'Wow, absolutely gorgeous!',
      'Need to visit here ASAP!',
      'Incredible vibes ✨',
      'Perfection!',
    ];

    for (let i = 0; i < 20; i++) {
      const postIdx = Math.floor(Math.random() * posts.length);
      const userIdx = Math.floor(Math.random() * usernames.length);
      const text = commentTexts[Math.floor(Math.random() * commentTexts.length)];

      try {
        await db.query(
          'INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3)',
          [userIds[usernames[userIdx]], posts[postIdx], text]
        );
      } catch (e) {
        // Ignore errors
      }
    }

    console.log('✅ Comments created');

    // Create follows
    const followPairs = new Set();
    for (let i = 0; i < 15; i++) {
      let follower = usernames[Math.floor(Math.random() * usernames.length)];
      let following = usernames[Math.floor(Math.random() * usernames.length)];

      if (follower !== following && !followPairs.has(`${follower}-${following}`)) {
        followPairs.add(`${follower}-${following}`);
        try {
          await db.query(
            'INSERT INTO followers (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userIds[follower], userIds[following]]
          );
        } catch (e) {
          // Ignore duplicates
        }
      }
    }

    console.log('✅ Follows created');

    // Create notifications
    for (const pair of followPairs) {
      const [follower, following] = pair.split('-');
      await db.query(
        `INSERT INTO notifications (recipient_id, actor_id, type)
         VALUES ($1, $2, 'follow') ON CONFLICT DO NOTHING`,
        [userIds[following], userIds[follower]]
      );
    }

    console.log('✅ Notifications created');
    console.log('🎉 Seeding complete!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seed();
