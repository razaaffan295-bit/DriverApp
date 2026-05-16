const NodeCache = require('node-cache')

// Cache for 60 seconds by default
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
})

const cacheMiddleware = (duration = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // Skip cache for auth-sensitive endpoints
    const skipPaths = [
      '/notifications',
      '/messages',
      '/subscription/check',
    ]
    if (skipPaths.some((p) => req.path.includes(p))) {
      return next()
    }

    // Create unique cache key per user
    const userId = req.user?._id || req.user?.id || 'guest'
    const key = `${userId}:${req.originalUrl}`

    const cached = cache.get(key)
    if (cached) {
      return res.json(cached)
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res)
    res.json = (body) => {
      if (res.statusCode === 200 && body?.success) {
        cache.set(key, body, duration)
      }
      return originalJson(body)
    }

    next()
  }
}

// Clear cache for specific user
const clearUserCache = (userId) => {
  const keys = cache.keys()
  keys.forEach((key) => {
    if (key.startsWith(`${userId}:`)) {
      cache.del(key)
    }
  })
}

// Clear all cache
const clearAllCache = () => {
  cache.flushAll()
}

module.exports = {
  cacheMiddleware,
  clearUserCache,
  clearAllCache,
}
