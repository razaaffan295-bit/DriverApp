import API from './axios'

export const sendMessage = (data) =>
  API.post('/api/messages/send', data)

export const getMessages = (jobId, userId) =>
  API.get(`/api/messages/${jobId}/${userId}`)

export const getConversations = () =>
  API.get('/api/messages/conversations/all')
