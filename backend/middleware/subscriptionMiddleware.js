const User = require('../models/User')

const requireActiveSubscription = async (
  req, res, next
) => {
  try {
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

    // Subscription not required yet (free trial)
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
      })
    }

    // Not yet deadline - allow but warn
    next()
  } catch (error) {
    console.error('Subscription check error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error',
    })
  }
}

module.exports = { requireActiveSubscription }
