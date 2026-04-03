import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Link,
  NavLink,
  useNavigate,
} from 'react-router-dom'
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
import { getSubscriptions } from '../../api/adminAPI'

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

const daysRemaining = (end) => {
  if (!end) return null
  const ms = new Date(end).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

const AdminSubscriptions = () => {
  const navigate = useNavigate()
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [applied, setApplied] = useState({ role: '', status: '' })
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (applied.role) params.role = applied.role
      if (applied.status) params.status = applied.status
      const res = await getSubscriptions(params)
      setList(res.data?.subscriptions ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Load nahi hua'
      )
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const ownerSubs = list.filter((s) => s.role === 'owner')
    const driverSubs = list.filter((s) => s.role === 'driver')
    const sum = (arr) =>
      arr.reduce((a, s) => a + (Number(s.amount) || 0), 0)
    return {
      ownerCount: ownerSubs.length,
      ownerRev: sum(ownerSubs),
      driverCount: driverSubs.length,
      driverRev: sum(driverSubs),
    }
  }, [list])

  const handleLogout = () => {
    clearAuth()
    navigate('/admin/login')
    toast.success('Logout ho gaye!')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col bg-gradient-to-b from-violet-900 to-purple-950 shadow-xl md:flex">
        <div className="border-b border-white/10 px-6 py-5">
          <span className="text-lg font-bold text-white">
            Admin Panel
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdDashboard className="h-5 w-5 shrink-0" />
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Saare Users
          </NavLink>
          <NavLink
            to="/admin/users?role=owner"
            className={sidebarInactive}
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Owners
          </NavLink>
          <NavLink
            to="/admin/users?role=driver"
            className={sidebarInactive}
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Drivers
          </NavLink>
          <Link to="/admin/dashboard" className={sidebarInactive}>
            <MdWork className="h-5 w-5 shrink-0" />
            Jobs
          </Link>
          <NavLink
            to="/admin/complaints"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdWarning className="h-5 w-5 shrink-0" />
            Complaints
          </NavLink>
          <NavLink
            to="/admin/subscriptions"
            end
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdSubscriptions className="h-5 w-5 shrink-0" />
            Subscriptions
          </NavLink>
          <Link to="/admin/subscriptions" className={sidebarInactive}>
            <MdAttachMoney className="h-5 w-5 shrink-0" />
            Revenue
          </Link>
        </nav>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:left-64 md:px-6">
        <h1 className="text-lg font-semibold text-gray-800">
          Subscriptions
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
            Logout
          </button>
        </div>
      </header>

      <main className="min-h-screen pb-24 pt-16 md:ml-64 md:pb-8">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex flex-wrap gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div>
              <label className="text-xs text-gray-600">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="owner">Owner</option>
                <option value="driver">Driver</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setApplied({
                    role: roleFilter,
                    status: statusFilter,
                  })
                }
                className="rounded-xl bg-purple-700 px-5 py-2 text-sm font-semibold text-white"
              >
                Filter
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                Owner subscriptions
              </p>
              <p className="text-2xl font-bold text-blue-900">
                {stats.ownerCount}
              </p>
              <p className="text-sm text-blue-800">
                Revenue: {fmtMoney(stats.ownerRev)}
              </p>
            </div>
            <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
              <p className="text-sm text-green-900">
                Driver subscriptions
              </p>
              <p className="text-2xl font-bold text-green-900">
                {stats.driverCount}
              </p>
              <p className="text-sm text-green-800">
                Revenue: {fmtMoney(stats.driverRev)}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-10 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" />
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {list.map((s) => {
                const u = s.userId
                const dr = daysRemaining(s.endDate)
                return (
                  <li
                    key={s._id}
                    className="rounded-2xl border border-gray-100 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {u?.name || 'User'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {u?.phone}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            s.role === 'owner'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {s.role}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : s.status === 'expired'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-bold text-purple-900">
                      {fmtMoney(s.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Start: {fmtDate(s.startDate)} · End:{' '}
                      {fmtDate(s.endDate)}
                    </p>
                    {dr !== null ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Days remaining: {dr}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminSubscriptions
