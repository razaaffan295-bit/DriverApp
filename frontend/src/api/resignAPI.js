import API from './axios'

export const requestResign = (data) =>
  API.post('/api/resign/request', data)

export const handleResign = (data) =>
  API.put('/api/resign/handle', data)

export const getResignRequests = () =>
  API.get('/api/resign')
