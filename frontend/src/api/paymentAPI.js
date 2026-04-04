import API from './axios'

export const getPaymentSummary = (params) =>
  API.get('/api/payments/summary', { params })

export const makePayment = (data) =>
  API.post('/api/payments/make', data)

export const confirmPayment = (data) =>
  API.put('/api/payments/confirm', data)

export const rejectPayment = (data) =>
  API.put('/api/payments/reject', data)

export const getPayments = (params) =>
  API.get('/api/payments/history', { params })

export const requestPayment = (data) =>
  API.post('/api/payments/request', data)

export const requestTripPayment = (data) =>
  API.post('/api/payments/trip-request', data)

export const requestAdvance = (data) =>
  API.post('/api/payments/advance/request', data)

export const handleAdvance = (data) =>
  API.put('/api/payments/advance/handle', data)

export const getAdvances = (params) =>
  API.get('/api/payments/advances', { params })
