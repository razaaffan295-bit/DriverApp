import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import API from '../../api/axios'
import { setAuth } from '../../utils/helpers'

const Login = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    if (!formData.phone.trim() || !formData.password) {
      setError('Phone aur password zaroori hain')
      return false
    }
    if (!/^\d{10}$/.test(formData.phone.trim())) {
      setError('Phone number exactly 10 digits ka hona chahiye')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      const { data } = await API.post('/api/auth/login', {
        phone: formData.phone.trim(),
        password: formData.password,
      })
      if (data.success && data.token && data.user) {
        setAuth(data.token, data.user)
        toast.success('Login ho gaye!')
        if (data.user.role === 'owner') {
          navigate('/owner/dashboard')
        } else if (data.user.role === 'driver') {
          navigate('/driver/dashboard')
        } else if (data.user.role === 'admin') {
          navigate('/admin/dashboard')
        } else {
          navigate('/')
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Kuch galat hua'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-4 overflow-x-hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto p-6 md:p-8 mt-8 md:mt-16 mb-8">
        <h1 className="text-3xl font-bold text-blue-700 text-center mb-1">
          DriverApp
        </h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          Wapas aaye! Login karein
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Phone Number
            </label>
            <input
              className="input-field"
              type="tel"
              name="phone"
              maxLength={10}
              value={formData.phone}
              onChange={handleChange}
              autoComplete="tel"
            />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Password
            </label>
            <input
              className="input-field"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login Karein'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Naya account banana hai?{' '}
          <Link
            to="/signup"
            className="text-blue-600 font-semibold"
          >
            Register karein
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login
