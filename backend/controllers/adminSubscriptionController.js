const mongoose = require('mongoose')
const User = require('../models/User')
const Notification = require('../models/Notification')

// Constants
const FREE_TRIAL_DAYS = 30
const EXPIRING_SOON_DAYS = 25
const MS_PER_DAY = 24 * 60 * 60 * 1000

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const MIN_DEADLINE_DAYS = 1
const MAX_DEADLINE_DAYS = 365
const MIN_EXTEND_DAYS = 1
const MAX_EXTEND_DAYS = 365

const DEFAULT_DEADLINE_DAYS = 5
const DEFAULT_EXTEND_DAYS = 15

// Helpers
const sendServerError = (res) => {
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Server error'
      : undefined,
  })
}

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ''))
}

const createNotificationSafe = (data) => {
  Notification.create(data).catch(() => {
    // Silent fail - non-blocking
  })
}

const getFreeTrialUsers = async (req, res) => {
  try {
    const { role, category, page = 1, limit = DEFAULT_LIMIT } = req.query

    const lim = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT)
    const pg = Math.max(Number(page) || 1, 1)

    const now = new Date()

    // Build query with optional role filter
    const query = {
      role: { $in: ['owner', 'driver'] },
      isBlocked: false,
    }
    if (role === 'owner' || role === 'driver') {
      query.role = role
    }

    // Parallel - users + total (with sort by createdAt for stable pagination)
    const [users, total] = await Promise.all([
      User.find(query)
        .select(
          'name phone role freeTrialStart subscriptionRequired subscriptionDeadline isPermanentFree subscription createdAt'
        )
        .sort({ createdAt: -1 })
        .limit(lim)
        .skip((pg - 1) * lim)
        .lean(),
      User.countDocuments(query),
    ])

    const result = users.map((u) => {
      const trialStart = u.freeTrialStart || u.createdAt
      const daysSinceJoin = Math.floor(
        (now - new Date(trialStart)) / MS_PER_DAY
      )
      const daysLeft = Math.max(0, FREE_TRIAL_DAYS - daysSinceJoin)

      const isPaid =
        u.subscription?.isActive &&
        u.subscription?.endDate &&
        new Date(u.subscription.endDate) > now

      let cat = 'free'
      if (u.isPermanentFree) cat = 'permanent_free'
      else if (u.subscriptionRequired) {
        cat = isPaid ? 'paid' : 'expired'
      } else if (daysSinceJoin >= FREE_TRIAL_DAYS) cat = 'expiring'
      else if (daysSinceJoin >= EXPIRING_SOON_DAYS) cat = 'expiring_soon'

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
        isSubscribed: !!isPaid,
        category: cat,
      }
    })

    // Optional category filter (applied after mapping)
    const filtered = category
      ? result.filter((u) => u.category === category)
      : result

    // Sort by days left (existing behavior)
    filtered.sort((a, b) => a.daysLeft - b.daysLeft)

    res.json({
      success: true,
      users: filtered,
      total,
      page: pg,
      totalPages: Math.ceil(total / lim) || 0,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const requireSubscription = async (req, res) => {
  try {
    const { userId, daysToDeadline = DEFAULT_DEADLINE_DAYS } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required',
      })
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    // Validate days range
    const days = Number(daysToDeadline)
    if (
      !Number.isFinite(days) ||
      days < MIN_DEADLINE_DAYS ||
      days > MAX_DEADLINE_DAYS
    ) {
      return res.status(400).json({
        success: false,
        message: `Days ${MIN_DEADLINE_DAYS} se ${MAX_DEADLINE_DAYS} ke beech honi chahiye`,
      })
    }

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + days)

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        subscriptionRequired: true,
        subscriptionDeadline: deadline,
      },
      { new: true }
    )
      .select('_id')
      .lean()

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Non-blocking notification
    createNotificationSafe({
      userId,
      title: 'Subscription Required',
      message: `Your free trial is ending. Please subscribe within ${days} days to continue using DriverApp.`,
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
    return sendServerError(res)
  }
}

const extendFreeTrial = async (req, res) => {
  try {
    const { userId, days = DEFAULT_EXTEND_DAYS } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required',
      })
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    // Validate days range
    const daysNum = Number(days)
    if (
      !Number.isFinite(daysNum) ||
      daysNum < MIN_EXTEND_DAYS ||
      daysNum > MAX_EXTEND_DAYS
    ) {
      return res.status(400).json({
        success: false,
        message: `Days ${MIN_EXTEND_DAYS} se ${MAX_EXTEND_DAYS} ke beech honi chahiye`,
      })
    }

    // Get user first (need freeTrialStart + createdAt + role)
    const user = await User.findById(userId)
      .select('freeTrialStart createdAt role')
      .lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const baseTime = (user.freeTrialStart || user.createdAt).getTime
      ? (user.freeTrialStart || user.createdAt).getTime()
      : new Date(user.freeTrialStart || user.createdAt).getTime()

    const newTrialStart = new Date(baseTime + daysNum * MS_PER_DAY)

    await User.findByIdAndUpdate(userId, {
      freeTrialStart: newTrialStart,
      subscriptionRequired: false,
      subscriptionDeadline: null,
    })

    // Non-blocking notification
    createNotificationSafe({
      userId,
      title: 'Free Trial Extended!',
      message: `Good news! Your free trial has been extended by ${daysNum} days.`,
      type: 'payment_received',
      link:
        user.role === 'owner' ? '/owner/dashboard' : '/driver/dashboard',
      isRead: false,
    })

    res.json({
      success: true,
      message: `Free trial ${daysNum} din extend kiya`,
    })
  } catch (error) {
    return sendServerError(res)
  }
}

const setPermanentFree = async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required',
      })
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isPermanentFree: true,
        subscriptionRequired: false,
        subscriptionDeadline: null,
      },
      { new: true }
    )
      .select('role')
      .lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Non-blocking notification
    createNotificationSafe({
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
    return sendServerError(res)
  }
}

const removePermanentFree = async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId required',
      })
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isPermanentFree: false },
      { new: true }
    )
      .select('role')
      .lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Non-blocking notification
    createNotificationSafe({
      userId,
      title: 'Free Access Removed',
      message:
        'Your permanent free access has been removed. Subscription rules apply now.',
      type: 'payment_received',
      link: user.role === 'owner' ? '/owner/dashboard' : '/driver/dashboard',
      isRead: false,
    })

    res.json({ success: true })
  } catch (error) {
    return sendServerError(res)
  }
}

module.exports = {
  getFreeTrialUsers,
  requireSubscription,
  extendFreeTrial,
  setPermanentFree,
  removePermanentFree,
}
