import API from './axios'

export const getNotifications = () =>
  API.get('/api/notifications')

export const markAllRead = () =>
  API.put('/api/notifications/mark-all-read')

export const markOneRead = (id) =>
  API.put(`/api/notifications/${id}/read`)
