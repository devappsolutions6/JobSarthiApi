// High-performance in-memory cache manager (pure Node.js memory)
const memoryCache = new Map();

// Single-Flight Request Coalescing Map to prevent Cache Stampede & Thundering Herd
const pendingPromises = new Map();

// Periodic cleanup of expired keys in memory cache
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiry < now) {
      memoryCache.delete(key);
    }
  }
}, 60000).unref(); // Avoid keeping the event loop alive

// Get cached data by key
const getCache = async (key) => {
  const cached = memoryCache.get(key);
  if (cached) {
    if (cached.expiry > Date.now()) {
      return cached.data;
    }
    memoryCache.delete(key); // Evict expired key
  }
  return null;
};

// Set cache with a TTL (time to live in seconds) and a +/- 10% random jitter to smooth out cache expirations
const setCache = async (key, data, ttlSeconds = 300) => {
  // TTL Jitter: Adds a +/- 10% random offset (creates a 20% window)
  // This prevents concurrent expiration stampedes when multiple keys are cached at a similar time
  const jitterRatio = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
  const jitteredTtl = Math.round(ttlSeconds * jitterRatio);

  memoryCache.set(key, {
    data,
    expiry: Date.now() + jitteredTtl * 1000,
  });
};

// Single-Flight Request Coalescing wrapper
// Solves Thundering Herd / Cache Stampede by checking if there's already a pending fetch for this key
// If so, all concurrent requests await the SAME promise instead of slamming the database
const fetchCached = async (key, fetchFn, ttlSeconds = 300) => {
  // Bypass cache in local development to always serve fresh data
  if (process.env.NODE_ENV !== "production") {
    return await fetchFn();
  }

  // A. Quick check on existing cache
  const cached = await getCache(key);
  if (cached !== null) return cached;

  // B. Single-Flight request coalescing
  if (pendingPromises.has(key)) {
    return pendingPromises.get(key);
  }

  // C. Execute the fetch, set cache, and cleanup pending promise
  const fetchPromise = (async () => {
    try {
      const data = await fetchFn();
      await setCache(key, data, ttlSeconds);
      return data;
    } finally {
      pendingPromises.delete(key); // Evict pending promise once settled
    }
  })();

  pendingPromises.set(key, fetchPromise);
  return fetchPromise;
};

// Delete a specific cache key (call this when data is updated)
const clearCache = async (key) => {
  memoryCache.delete(key);
};

// Clear cache keys matching a pattern (wildcard * supported, e.g., 'homepage_jobs_*')
const clearCachePattern = async (pattern) => {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  let clearedCount = 0;
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      clearedCount++;
    }
  }
  if (clearedCount > 0) {
    console.log(`🧹 [Cache] Cleared ${clearedCount} cached keys matching pattern: "${pattern}"`);
  }
};

// Clear the entire in-memory cache and active coalescer promises
const clearAllCache = async () => {
  memoryCache.clear();
  pendingPromises.clear();
  console.log("🧹 [Cache] Local in-memory cache and request-coalescer cleared successfully.");
};

module.exports = {
  getCache,
  setCache,
  fetchCached,
  clearCache,
  clearCachePattern,
  clearAllCache,
};
