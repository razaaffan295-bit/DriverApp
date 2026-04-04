import API from './axios'

export const createTrip = (data) =>
  API.post('/api/trips/create', data)

export const addExpense = (data) =>
  API.post('/api/trips/add-expense', data)

export const addRepair = (data) =>
  API.post('/api/trips/add-repair', data)

export const completeTrip = (data) =>
  API.post('/api/trips/complete', data)

export const submitTrip = (data) =>
  API.post('/api/trips/submit', data)

export const getActiveTrip = () => API.get('/api/trips/active')

export const getDriverTrips = () => API.get('/api/trips/driver')

export const getOwnerTrips = (params) =>
  API.get('/api/trips/owner', { params })

export const handleTrip = (data) =>
  API.post('/api/trips/handle', data)

export const reviewTrip = (data) =>
  API.put('/api/trips/review', data)

export const createRepairRequest = (data) =>
  API.post('/api/trips/repair/create', data)

export const reviewRepairRequest = (data) =>
  API.put('/api/trips/repair/review', data)
