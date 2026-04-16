import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import API from '../../api/axios'
import { setAuth } from '../../utils/helpers'
import { STATES } from '../../utils/constants'
import { useTranslation } from 'react-i18next'

const Signup = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'owner',
    state: '',
    district: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const setRole = (role) => {
    setFormData((prev) => ({ ...prev, role }))
  }

  const validate = () => {
    if (
      !formData.name.trim() ||
      !formData.phone.trim() ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.state ||
      !formData.district.trim()
    ) {
      setError(t('allFieldsRequired'))
      return false
    }
    if (!/^\d{10}$/.test(formData.phone.trim())) {
      setError(t('phoneMustBe10'))
      return false
    }
    if (formData.password.length < 6) {
      setError(t('passwordMin6'))
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordMismatch'))
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
      const { data } = await API.post('/api/auth/register', {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: formData.role,
        state: formData.state,
        district: formData.district.trim(),
      })
      if (data.success && data.token && data.user) {
        setAuth(data.token, data.user)
        toast.success(t('accountCreated'))
        if (data.user.role === 'owner') {
          navigate('/owner/dashboard')
        } else {
          navigate('/driver/dashboard')
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          t('signupFailed')
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
          {t('createAccount')}
        </p>

        <div className="bg-gray-100 rounded-xl p-1 flex mb-6">
          <button
            type="button"
            onClick={() => setRole('owner')}
            className={`flex-1 min-h-[44px] py-2.5 rounded-lg text-sm font-medium transition-all ${
              formData.role === 'owner'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-gray-500 bg-transparent'
            }`}
          >
            {t('vehicleOwnerBtn')}
          </button>
          <button
            type="button"
            onClick={() => setRole('driver')}
            className={`flex-1 min-h-[44px] py-2.5 rounded-lg text-sm font-medium transition-all ${
              formData.role === 'driver'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-gray-500 bg-transparent'
            }`}
          >
            {t('driverBtn')}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {t('nameLabel')}
            </label>
            <input
              className="input-field"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              autoComplete="name"
            />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {t('phoneNumberLabel')}
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
              {t('passwordLabel')}
            </label>
            <input
              className="input-field"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {t('confirmPasswordLabel')}
            </label>
            <input
              className="input-field"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {t('stateLabel')}
            </label>
            <select
              className="input-field"
              name="state"
              value={formData.state}
              onChange={handleChange}
            >
              <option value="">{t('stateSelect')}</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              {t('district')}
            </label>
            <input
              className="input-field"
              type="text"
              name="district"
              value={formData.district}
              onChange={handleChange}
              autoComplete="address-level2"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? t('creatingProgress') : t('createAccountBtn')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {t('alreadyHaveAccount')}{' '}
          <Link
            to="/login"
            className="text-blue-600 font-semibold"
          >
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Signup
