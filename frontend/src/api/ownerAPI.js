import API from './axios'

export const getOwnerProfile = () =>
  API.get('/api/owner/profile')

export const updateOwnerProfile = (data) =>
  API.put('/api/owner/profile', data)

export const addVehicle = (data) =>
  API.post('/api/owner/vehicles', data)

export const getVehicles = () =>
  API.get('/api/owner/vehicles')

export const getVehicleDetail = (id) =>
  API.get(`/api/owner/vehicles/${id}`)

export const deleteVehicle = (id) =>
  API.delete(`/api/owner/vehicles/${id}`)

export const createJob = (data) =>
  API.post('/api/jobs', data)

export const getOwnerJobs = () =>
  API.get('/api/jobs/my-jobs')

export const getJobById = (id) =>
  API.get(`/api/jobs/${id}`)

export const closeJob = (id) =>
  API.put(`/api/jobs/${id}/close`)

export const getOwnerApplications = () =>
  API.get('/api/applications/my-applications')

export const getJobApplications = (jobId) =>
  API.get(`/api/applications/job/${jobId}`)

export const acceptApplication = (id) =>
  API.put(`/api/applications/${id}/accept`)

export const rejectApplication = (id) =>
  API.put(`/api/applications/${id}/reject`)

export const cancelApplication = (id) =>
  API.put(`/api/applications/${id}/cancel`)

export const getPublicDriverProfile = (id) =>
  API.get(`/api/driver/public/${id}`)

export const getDriverDetail = (id) =>
  API.get(`/api/owner/driver-detail/${id}`)
