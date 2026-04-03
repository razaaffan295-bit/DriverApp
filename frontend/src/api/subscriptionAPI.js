import API from './axios'

export const createOrder = () =>
  API.post('/api/subscription/create-order')

export const verifyPayment = (data) =>
  API.post('/api/subscription/verify', data)

export const checkSubscription = () =>
  API.get('/api/subscription/check')
