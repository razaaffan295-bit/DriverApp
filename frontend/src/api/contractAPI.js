import API from './axios'

export const createContract = (data) =>
  API.post('/api/contracts', data)

export const getOwnerContracts = () =>
  API.get('/api/contracts/owner')

export const getContractById = (id) =>
  API.get(`/api/contracts/${id}`)

export const signContract = (id) =>
  API.put(`/api/contracts/${id}/sign`)

export const completeContract = (id) =>
  API.put(`/api/contracts/${id}/complete`)

export const getDriverActiveContract = () =>
  API.get('/api/contracts/driver/active')

export const getDriverContractHistory = () =>
  API.get('/api/contracts/driver/history')

export const getDriverContracts = () =>
  API.get('/api/contracts/driver/all')
