import API from './axios'

export const createComplaint = (data) =>
  API.post('/api/complaints', data)

export const getMyComplaints = () =>
  API.get('/api/complaints/my')

export const getComplaintById = (id) =>
  API.get(`/api/complaints/${id}`)
