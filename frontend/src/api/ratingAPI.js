import API from './axios'

export const giveRating = (data) =>
  API.post('/api/ratings', data)

export const getMyRatings = () =>
  API.get('/api/ratings/my')

export const getUserRatings = (userId) =>
  API.get(`/api/ratings/user/${userId}`)
