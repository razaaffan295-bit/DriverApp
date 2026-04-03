import API from './axios'

export const sendInvite = (data) => API.post('/api/invites/send', data)

export const getOwnerInvites = () => API.get('/api/invites/owner')

export const getDriverInvites = () => API.get('/api/invites/driver')

export const acceptInvite = (data) => API.put('/api/invites/accept', data)

export const rejectInvite = (data) => API.put('/api/invites/reject', data)

