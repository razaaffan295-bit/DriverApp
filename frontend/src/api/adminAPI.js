import API from './axios'

export const getAdminStats = () =>
  API.get('/api/admin/stats')

export const getUsers = (params) =>
  API.get('/api/admin/users', { params })

export const blockUser = (data) =>
  API.put('/api/admin/users/block', data)

export const unblockUser = (data) =>
  API.put('/api/admin/users/unblock', data)

export const getAllComplaints = (params) =>
  API.get('/api/admin/complaints', { params })

export const resolveComplaint = (data) =>
  API.put('/api/admin/complaints/resolve', data)

export const getSubscriptions = (params) =>
  API.get('/api/admin/subscriptions', { params })

export const verifyUser = (data) =>
  API.put('/api/admin/users/verify', data)
