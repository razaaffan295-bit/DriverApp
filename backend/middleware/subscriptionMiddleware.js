const User = require('../models/User')

// Helper for consistent 500 responses
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  })
}

const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Login karein pehle',
      })
    }

    const userId = req.user._id || req.user.id

    const user = await User.findById(userId)
      .select(
        'isPermanentFree subscriptionRequired subscriptionDeadline subscription role'
      )
      .lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Admin always allowed
    if (user.role === 'admin') return next()

    // Permanent free users
    if (user.isPermanentFree) return next()

    // Subscription not required yet (free trial active)
    if (!user.subscriptionRequired) return next()

    // Subscription required - check if paid
    const isPaid =
      user.subscription?.isActive === true &&
      user.subscription?.endDate &&
      new Date(user.subscription.endDate) > new Date()

    if (isPaid) return next()

    // Check deadline
    const deadlinePassed = user.subscriptionDeadline
      ? new Date(user.subscriptionDeadline) < new Date()
      : false

    if (deadlinePassed) {
      return res.status(402).json({
        success: false,
        message: 'Subscription required',
        subscriptionRequired: true,
        deadlinePassed: true,
        code: 'SUBSCRIPTION_REQUIRED',
      })
    }

    // Not yet deadline - allow but warn (existing behavior)
    next()
  } catch (error) {
    return sendServerError(res)
  }
}

module.exports = { requireActiveSubscription }
