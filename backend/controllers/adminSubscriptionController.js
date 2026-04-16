const User = require('../models/User')
const Notification = require('../models/Notification')

// Get all users with free trial stats
const getFreeTrialUsers = async (req, res) => {
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(
      now.getTime() - 8 * 24 * 60 * 60 * 1000
    )
    const twentyFiveDaysAgo = new Date(
      now.getTime() - 25 * 24 * 60 * 60 * 1000
    )

    const users = await User.find({
      role: { $in: ['owner', 'driver'] },
      isBlocked: false,
    }).select(
      'name phone role freeTrialStart subscriptionRequired subscriptionDeadline isPermanentFree subscription createdAt'
    )

    const result = users.map((u) => {
      const trialStart = u.freeTrialStart || u.createdAt
      const daysSinceJoin = Math.floor(
        (now - new Date(trialStart)) / (24 * 60 * 60 * 1000)
      )
      const daysLeft = Math.max(0, 8 - daysSinceJoin)

      let category = 'free'
      if (u.isPermanentFree) category = 'permanent_free'
      else if (u.subscriptionRequired) {
        const isPaid =
          u.subscription?.isActive &&
          u.subscription?.endDate &&
          new Date(u.subscription.endDate) > now
        category = isPaid ? 'paid' : 'expired'
      } else if (daysSinceJoin >= 8) category = 'expiring'
      else if (daysSinceJoin >= 6) category = 'expiring_soon'

      return {
        _id: u._id,
        name: u.name,
        phone: u.phone,
        role: u.role,
        daysSinceJoin,
        daysLeft,
        freeTrialStart: trialStart,
        subscriptionRequired: u.subscriptionRequired,
        subscriptionDeadline: u.subscriptionDeadline,
        isPermanentFree: u.isPermanentFree,
        isSubscribed:
          u.subscription?.isActive &&
          u.subscription?.endDate &&
          new Date(u.subscription.endDate) > now,
        category,
      }
    })

    // Sort: expiring first, then expiring_soon, then free
    result.sort((a, b) => a.daysLeft - b.daysLeft)

    res.json({ success: true, users: result })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Admin: require subscription for a user
const requireSubscription = async (req, res) => {
  try {
    const { userId, daysToDeadline = 5 } = req.body
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required',
      })
    }

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + daysToDeadline)

    await User.findByIdAndUpdate(userId, {
      subscriptionRequired: true,
      subscriptionDeadline: deadline,
    })

    // Send notification to user
    await Notification.create({
      userId,
      title: 'Subscription Required',
      message: `Your free trial is ending. Please subscribe within ${daysToDeadline} days to continue using DriverApp.`,
      type: 'payment_received',
      link: '/subscription',
      isRead: false,
    })

    res.json({
      success: true,
      message: 'Subscription required set kiya',
      deadline,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Admin: extend free trial
const extendFreeTrial = async (req, res) => {
  try {
    const { userId, days = 15 } = req.body
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Reset subscription required and extend trial
    const newTrialStart = new Date(
      (user.freeTrialStart || user.createdAt).getTime() +
        days * 24 * 60 * 60 * 1000
    )

    await User.findByIdAndUpdate(userId, {
      freeTrialStart: newTrialStart,
      subscriptionRequired: false,
      subscriptionDeadline: null,
    })

    await Notification.create({
      userId,
      title: 'Free Trial Extended!',
      message: `Good news! Your free trial has been extended by ${days} days.`,
      type: 'payment_received',
      link:
        user.role === 'owner'
          ? '/owner/dashboard'
          : '/driver/dashboard',
      isRead: false,
    })

    res.json({
      success: true,
      message: `Free trial ${days} din extend kiya`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Admin: set permanent free
const setPermanentFree = async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required',
      })
    }

    const user = await User.findByIdAndUpdate(userId, {
      isPermanentFree: true,
      subscriptionRequired: false,
      subscriptionDeadline: null,
    }, { new: true }).select('role')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    await Notification.create({
      userId,
      title: 'Premium Access Granted!',
      message:
        'You have been granted permanent free access to DriverApp. Enjoy!',
      type: 'payment_received',
      link: user.role === 'owner' ? '/owner/dashboard' : '/driver/dashboard',
      isRead: false,
    })

    res.json({
      success: true,
      message: 'Permanent free set kiya',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Admin: remove permanent free
const removePermanentFree = async (req, res) => {
  try {
    const { userId } = req.body
    await User.findByIdAndUpdate(userId, {
      isPermanentFree: false,
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

module.exports = {
  getFreeTrialUsers,
  requireSubscription,
  extendFreeTrial,
  setPermanentFree,
  removePermanentFree,
}

