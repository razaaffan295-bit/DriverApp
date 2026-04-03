import API from './axios'

export const createTrip = (data) =>
  API.post('/api/trips/create', data)

export const addExpense = (data) =>
  API.post('/api/trips/expense/add', data)

export const submitTrip = (data) =>
  API.post('/api/trips/submit', data)

export const getDriverTrips = () =>
  API.get('/api/trips/driver')

export const getOwnerTrips = (params) =>
  API.get('/api/trips/owner', { params })

export const reviewTrip = (data) =>
  API.put('/api/trips/review', data)

export const createRepairRequest = (data) =>
  API.post('/api/trips/repair/create', data)

export const reviewRepairRequest = (data) =>
  API.put('/api/trips/repair/review', data)

