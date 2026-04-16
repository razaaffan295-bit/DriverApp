import API from './axios'

export const getFreeTrialUsers = () =>
  API.get('/api/admin/subscriptions/users')

export const requireSubscription = (userId, daysToDeadline = 5) =>
  API.post('/api/admin/subscriptions/require', {
    userId,
    daysToDeadline,
  })

export const extendFreeTrial = (userId, days = 15) =>
  API.post('/api/admin/subscriptions/extend', {
    userId,
    days,
  })

export const setPermanentFree = (userId) =>
  API.post('/api/admin/subscriptions/permanent-free', {
    userId,
  })

export const removePermanentFree = (userId) =>
  API.post('/api/admin/subscriptions/remove-permanent-free', {
    userId,
  })

