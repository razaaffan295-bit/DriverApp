// Constants
const SLOW_REQUEST_MS = 1000
const SKIP_PATHS = [
  '/api/health',
  '/api/notifications',
]

// Check if path should skip logging
const shouldSkipLogging = (path) => {
  return SKIP_PATHS.some((p) => path.startsWith(p) || path.includes(p))
}

// Mask user ID for privacy (show only last 4 chars)
const maskUserId = (userId) => {
  if (!userId) return 'guest'
  const str = String(userId)
  if (str.length <= 4) return str
  return `***${str.slice(-4)}`
}

const requestLogger = (req, res, next) => {
  const start = Date.now()
  const { method, originalUrl } = req

  // Skip logging for health checks and frequent polls
  if (shouldSkipLogging(originalUrl)) {
    return next()
  }

  res.on('finish', () => {
    try {
      const duration = Date.now() - start
      const status = res.statusCode

      // Only log slow requests or errors (production noise reduction)
      const shouldLog = duration > SLOW_REQUEST_MS || status >= 400

      if (!shouldLog) return

      const userIdMasked = maskUserId(req.user?._id || req.user?.id)
      const isDev = process.env.NODE_ENV !== 'production'

      if (isDev) {
        // Dev: colored output for terminal
        const statusColor =
          status >= 500
            ? '\x1b[31m' // red
            : status >= 400
              ? '\x1b[33m' // yellow
              : '\x1b[32m' // green
        const reset = '\x1b[0m'

        console.log(
          `${statusColor}[${method}]${reset} ${originalUrl} ` +
            `${statusColor}${status}${reset} ` +
            `${duration}ms user:${userIdMasked}`
        )
      } else {
        // Prod: structured plain text (no colors, masked userId)
        // Easier to parse in Render/log aggregators
        console.log(
          `[${method}] ${originalUrl} ${status} ${duration}ms user:${userIdMasked}`
        )
      }
    } catch {
      // Logging failure should never break the response
    }
  })

  next()
}

module.exports = requestLogger
