const cron = require('node-cron')
const User = require('../models/User')
const Notification = require('../models/Notification')

const runSubscriptionCron = () => {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running subscription cron...')
    try {
      const now = new Date()

      // Find users where subscriptionRequired=true
      // and deadline is in 5 days or less
      const users = await User.find({
        subscriptionRequired: true,
        subscriptionDeadline: { $gt: now },
        isPermanentFree: false,
      })

      for (const user of users) {
        const daysLeft = Math.ceil(
          (new Date(user.subscriptionDeadline) - now) /
            (24 * 60 * 60 * 1000)
        )

        // Send notification at 6, 4, 2 days
        if ([6, 4, 2].includes(daysLeft)) {
          // Check if already notified today
          const alreadyNotified =
            await Notification.findOne({
              userId: user._id,
              type: 'payment_received',
              createdAt: {
                $gte: new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate()
                ),
              },
              title: 'Subscription Reminder',
            })

          if (!alreadyNotified) {
            await Notification.create({
              userId: user._id,
              title: 'Subscription Reminder',
              message: `Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} left! Subscribe now to continue using DriverApp.`,
              type: 'payment_received',
              link: '/subscription',
              isRead: false,
            })
          }
        }
      }

      // Auto-expire free trial after 8 days
      // for users where subscriptionRequired=false
      // and freeTrialStart is 8+ days ago
      const thirtyDaysAgo = new Date(
        now.getTime() - 8 * 24 * 60 * 60 * 1000
      )

      const expiredTrialUsers = await User.find({
        role: { $in: ['owner', 'driver'] },
        subscriptionRequired: false,
        isPermanentFree: false,
        freeTrialStart: { $lte: thirtyDaysAgo },
      })

      for (const user of expiredTrialUsers) {
        // Check subscription not already paid
        const isPaid =
          user.subscription?.isActive &&
          user.subscription?.endDate &&
          new Date(user.subscription.endDate) > now

        if (!isPaid) {
          const deadline = new Date()
          deadline.setDate(deadline.getDate() + 2)

          await User.findByIdAndUpdate(user._id, {
            subscriptionRequired: true,
            subscriptionDeadline: deadline,
          })

          await Notification.create({
            userId: user._id,
            title: 'Free Trial Ended',
            message:
              'Your 8-day free trial has ended. Subscribe within 5 days to continue.',
            type: 'payment_received',
            link: '/subscription',
            isRead: false,
          })
        }
      }

      console.log('Subscription cron completed')
    } catch (error) {
      console.error('Cron error:', error)
    }
  })
}

module.exports = { runSubscriptionCron }

