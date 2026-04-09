import axios from 'axios'

const API = axios.create({
  baseURL:
    process.env.REACT_APP_API_URL || 'https://driverapp-backend.onrender.com',
})

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token')
  if (token) {
    req.headers.Authorization = `Bearer ${token}`
  }
  return req
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear()
      const p = window.location.pathname || ''
      window.location.href = p.startsWith('/admin')
        ? '/admin/login'
        : '/login'
    }
    return Promise.reject(error)
  }
)

export default API
