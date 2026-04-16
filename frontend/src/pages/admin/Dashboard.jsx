import { useEffect, useState, useCallback } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import {
  MdDashboard,
  MdPeople,
  MdWork,
  MdWarning,
  MdSubscriptions,
  MdAttachMoney,
  MdLogout,
} from 'react-icons/md'
import { clearAuth } from '../../utils/helpers'
import {
  getAdminStats,
  getAllComplaints,
} from '../../api/adminAPI'

const sidebarInactive =
  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-purple-100/90 hover:bg-white/10'
const sidebarActive =
  'flex items-center gap-3 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white'

const fmtMoney = (n) =>
  `₹${Number.isFinite(Number(n)) ? Number(n) : 0}`

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const AdminDashboard = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [pendingList, setPendingList] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([
        getAdminStats(),
        getAllComplaints({
          status: 'pending',
          limit: 5,
          page: 1,
        }),
      ])
      setStats(sRes.data?.stats ?? null)
      setPendingList(cRes.data?.complaints ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('loadError3')
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const handleLogout = () => {
    clearAuth()
    navigate('/admin/login')
    toast.success(t('logoutSuccess'))
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F5F3FF' }}
    >
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col bg-gradient-to-b from-violet-900 to-purple-950 shadow-xl md:flex">
        <div className="border-b border-white/10 px-6 py-5">
          <span className="text-lg font-bold text-white">
            {t('adminPanel')}
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLink
            to="/admin/dashboard"
            end
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdDashboard className="h-5 w-5 shrink-0" />
            {t('dashboard')}
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            {t('allUsers')}
          </NavLink>
          <NavLink
            to="/admin/users?role=owner"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            {t('owners')}
          </NavLink>
          <NavLink
            to="/admin/users?role=driver"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            {t('drivers')}
          </NavLink>
          <Link to="/admin/dashboard" className={sidebarInactive}>
            <MdWork className="h-5 w-5 shrink-0" />
            {t('jobs2')}
          </Link>
          <NavLink
            to="/admin/complaints"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdWarning className="h-5 w-5 shrink-0" />
            {t('complaints2')}
          </NavLink>
          <NavLink
            to="/admin/subscriptions"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdSubscriptions className="h-5 w-5 shrink-0" />
            {t('subscriptions2')}
          </NavLink>
          <NavLink
            to="/admin/subscriptions"
            className={sidebarInactive}
          >
            <MdAttachMoney className="h-5 w-5 shrink-0" />
            {t('revenue')}
          </NavLink>
          <NavLink
            to="/admin/subscription-manager"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Sub Manager
          </NavLink>
        </nav>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:left-64 md:px-6">
        <h1 className="text-lg font-semibold text-gray-800">
          {t('adminPanel')}
        </h1>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800 sm:inline">
            DriverApp Admin
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm font-medium text-red-600"
          >
            <MdLogout className="h-4 w-4" />
            {t('logoutBtn')}
          </button>
        </div>
      </header>

      <main className="min-h-screen pb-24 pt-16 md:ml-64 md:pb-8">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900">
            {t('adminDashboard')}
          </h2>

          {loading ? (
            <div className="mt-10 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" />
            </div>
          ) : stats ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs text-blue-800">
                    {t('totalOwners')}
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {stats.totalOwners}
                  </p>
                </div>
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <p className="text-xs text-green-800">
                    {t('totalDrivers')}
                  </p>
                  <p className="text-2xl font-bold text-green-900">
                    {stats.totalDrivers}
                  </p>
                </div>
                <div
                  className={`rounded-2xl border p-4 ${
                    stats.pendingComplaints > 0
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <p
                    className={`text-xs ${
                      stats.pendingComplaints > 0
                        ? 'text-red-800'
                        : 'text-gray-600'
                    }`}
                  >
                    {t('pendingComplaints2')}
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      stats.pendingComplaints > 0
                        ? 'text-red-700'
                        : 'text-gray-800'
                    }`}
                  >
                    {stats.pendingComplaints}
                  </p>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
                  <p className="text-xs text-purple-800">
                    {t('activeContracts')}
                  </p>
                  <p className="text-2xl font-bold text-purple-900">
                    {stats.activeContracts}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('revenue')}
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                    <p className="text-xs text-gray-600">
                      {t('monthlyRevenue')}
                    </p>
                    <p className="text-xl font-bold text-purple-900">
                      {fmtMoney(stats.monthlyRevenue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs text-gray-600">
                      {t('totalRevenue')}
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {fmtMoney(stats.totalRevenue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-xs text-gray-600">
                      {t('ownerRevenue')}
                    </p>
                    <p className="text-xl font-bold text-blue-900">
                      {fmtMoney(stats.ownerRevenue)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
                    <p className="text-xs text-gray-600">
                      {t('driverRevenue')}
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {fmtMoney(stats.driverRevenue)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  {t('jobs2')}: {stats.totalJobs} {t('jobsStats')} ·{' '}
                  {stats.activeJobs} {t('openLabel')}
                </p>
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('pendingComplaints2')}
                  </h3>
                  <Link
                    to="/admin/complaints"
                    className="text-sm font-medium text-purple-700"
                  >
                    {t('viewAllBtn')}
                  </Link>
                </div>
                {pendingList.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {t('noPendingComplaints')}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {pendingList.map((c) => (
                      <li
                        key={c._id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white p-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {c.raisedBy?.name} vs{' '}
                            {c.againstUser?.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {c.type} · {fmtDate(c.createdAt)}
                          </p>
                        </div>
                        <Link
                          to="/admin/complaints"
                          className="rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-800"
                        >
                          {t('view')}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="mt-8 text-gray-500">{t('statsLoadError')}</p>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
