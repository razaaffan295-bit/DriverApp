const requestLogger = (req, res, next) => {
  const start = Date.now()
  const { method, originalUrl, ip } = req

  // Skip logging for health checks and frequent polls
  const skipPaths = [
    '/api/health',
    '/api/notifications',
  ]
  if (skipPaths.some((p) => originalUrl.includes(p))) {
    return next()
  }

  res.on('finish', () => {
    const duration = Date.now() - start
    const userId = req.user?._id || 'guest'
    const status = res.statusCode

    // Color code based on status
    const statusColor =
      status >= 500
        ? '\x1b[31m'  // red
        : status >= 400
          ? '\x1b[33m'  // yellow
          : '\x1b[32m'  // green
    const reset = '\x1b[0m'

    // Only log slow requests or errors
    if (duration > 1000 || status >= 400) {
      console.log(
        `${statusColor}[${method}]${reset} ${originalUrl} ` +
        `${statusColor}${status}${reset} ` +
        `${duration}ms user:${userId}`
      )
    }
  })

  next()
}

module.exports = requestLogger
