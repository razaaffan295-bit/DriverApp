import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import API from '../../api/axios'
import { setAuth } from '../../utils/helpers'
import { useTranslation } from 'react-i18next'

const AdminLogin = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await API.post('/api/auth/login', {
        phone: String(phone).trim(),
        password,
      })
      const u = res.data?.user
      if (u?.role !== 'admin') {
        toast.error(t('adminAccessError'))
        return
      }
      setAuth(res.data.token, u)
      toast.success(t('welcomeAdmin'))
      navigate('/admin/dashboard')
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('loginError')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-900 px-4">
      <div className="w-full max-w-md rounded-3xl border border-purple-400/30 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
            DriverApp Admin
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            {t('adminLoginTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('adminLoginSubtitle')}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('phoneLabel2')}
            </label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0000000000"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('passwordLabel')}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-purple-700 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-800 disabled:opacity-50"
          >
            {loading ? '…' : t('loginBtn')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
