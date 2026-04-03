import API from './axios'

export const driverAddRecord = (data) =>
  API.post('/api/attendance/driver/add', data)

export const driverGetRecords = (params) =>
  API.get('/api/attendance/driver/records', { params })

export const driverDeleteRecord = (id) =>
  API.delete(`/api/attendance/driver/${id}`)

export const ownerAddRecord = (data) =>
  API.post('/api/attendance/owner/add', data)

export const ownerGetRecords = (params) =>
  API.get('/api/attendance/owner/records', { params })

export const ownerDeleteRecord = (id) =>
  API.delete(`/api/attendance/owner/${id}`)

export const ownerGetContracts = () =>
  API.get('/api/attendance/owner/contracts')
