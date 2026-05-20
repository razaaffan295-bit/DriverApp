const NodeCache = require('node-cache')

// Constants
const DEFAULT_TTL_SECONDS = 60
const CHECK_PERIOD_SECONDS = 120
const MAX_CACHE_KEYS = 5000 // Memory safety limit
const MAX_RESPONSE_SIZE_BYTES = 500 * 1024 // 500KB per response

// Cache instance
// useClones: true to prevent mutation poisoning
// maxKeys: prevent memory leaks
const cache = new NodeCache({
  stdTTL: DEFAULT_TTL_SECONDS,
  checkperiod: CHECK_PERIOD_SECONDS,
  useClones: true,
  maxKeys: MAX_CACHE_KEYS,
})

// Paths that should NEVER be cached (auth-sensitive or real-time)
const SKIP_PATHS = [
  '/notifications',
  '/messages',
  '/subscription/check',
  '/auth/me',
]

// Check if path should skip cache
const shouldSkipCache = (path) => {
  return SKIP_PATHS.some((p) => path.startsWith(p) || path.includes(p))
}

// Estimate object size in bytes (rough)
const estimateSize = (obj) => {
  try {
    return JSON.stringify(obj).length
  } catch {
    return Infinity // Reject if can't serialize
  }
}

const cacheMiddleware = (duration = DEFAULT_TTL_SECONDS) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // Skip auth-sensitive paths
    if (shouldSkipCache(req.path)) {
      return next()
    }

    // Allow bypass via query param (for testing/debugging)
    if (req.query.nocache === '1') {
      return next()
    }

    // Create unique cache key per user + URL
    const userId = req.user?._id || req.user?.id || 'guest'
    const key = `${userId}:${req.originalUrl}`

    // Try cache hit
    const cached = cache.get(key)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }

    // Mark as miss
    res.setHeader('X-Cache', 'MISS')

    // Override res.json to cache successful responses
    const originalJson = res.json.bind(res)
    res.json = function (body) {
      try {
        // Only cache successful 200 + success:true responses
        if (
          res.statusCode === 200 &&
          body &&
          typeof body === 'object' &&
          body.success === true
        ) {
          // Check size limit (memory safety)
          const size = estimateSize(body)
          if (size <= MAX_RESPONSE_SIZE_BYTES) {
            cache.set(key, body, duration)
          }
        }
      } catch {
        // Cache write failure shouldn't break response
      }
      return originalJson(body)
    }

    next()
  }
}

// Clear cache for specific user
const clearUserCache = (userId) => {
  if (!userId) return
  const prefix = `${String(userId)}:`
  const keys = cache.keys()
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      cache.del(key)
    }
  }
}

// Clear all cache
const clearAllCache = () => {
  cache.flushAll()
}

// Get cache statistics (for monitoring)
const getCacheStats = () => {
  return {
    keys: cache.keys().length,
    stats: cache.getStats(),
  }
}

module.exports = {
  cacheMiddleware,
  clearUserCache,
  clearAllCache,
  getCacheStats,
}
