import API from './axios'

export const getDriverProfile = () =>
  API.get('/api/driver/profile')

export const updateDriverProfile = (data) =>
  API.put('/api/driver/profile', data)

export const searchJobs = (params) =>
  API.get('/api/driver/jobs/search', { params })

export const getJobDetail = (id) =>
  API.get(`/api/driver/jobs/${id}`)

export const applyJob = (id) =>
  API.post(`/api/driver/jobs/${id}/apply`)

export const getDriverApplications = () =>
  API.get('/api/driver/my-applications')
