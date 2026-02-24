const Redis = require("ioredis");

let redis = null;

// Only connect to Redis if REDIS_URL is set in environment
// If not set, caching is silently skipped (app still works without Redis)
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  redis.on("connect", () => console.log("Redis connected"));
  redis.on("error", (err) => console.error("Redis error:", err.message));
}

// Get cached data by key
const getCache = async (key) => {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("Cache get error:", err.message);
    return null;
  }
};

// Set cache with a TTL (time to live in seconds)
const setCache = async (key, data, ttlSeconds = 300) => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    console.error("Cache set error:", err.message);
  }
};

// Delete a specific cache key (call this when data is updated)
const clearCache = async (key) => {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Cache clear error:", err.message);
  }
};

module.exports = { getCache, setCache, clearCache };
